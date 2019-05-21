// import * as d3 from "d3";
import Contextmenu from './lib/Contextmenu';
import utils from './lib/Utils';
import './styles/index.css';

// 封装外暴露的方法
// We also keep the actual d3-brush functions and their IDs in a list:
var brushes = [];
export default class Annotation {
  constructor(config) {
    // 配置项默认值
    let obj = {
      imageUrl:"", // 标注图片地址
      imageDiv:"", // SVG容器
      width:null, // SVG画布自定义宽度
      height:null, // SVG画布自定义高度
      data:[], // 初始化数据
      enableBrush:true // 是否允许修改标注信息
    }
    this.config = Object.assign({}, obj, config);
  }

  // 初始化画布
  init() {
    let _this = this;
    let image = new Image();
    image.src = _this.config.imageUrl;
    brushes = [];
    _this.currentMouseXY = {};
    _this.width = 0;
    _this.height = 0;
    image.onload = function () { // 必须等待图片加载完毕后再创建画布
      let width = _this.config.width;
      let height = _this.config.height;
      let imageWidth = image.naturalWidth;
      let imageHeight = image.naturalHeight;
      _this.width = width || imageWidth;
      _this.height = height || imageHeight;
      d3.select(_this.config.imageDiv).html("");
      let svg = d3.select(_this.config.imageDiv).append("svg")
        .attr("width", width || imageWidth)
        .attr("height", height || imageHeight)
        .append("g");

      // 增加图片缩放处理
      _this.scale = Math.min(_this.config.width / image.naturalWidth, _this.config.height / image.naturalHeight)
      if (_this.scale != 0) {
        svg.attr("transform", "scale(" + _this.scale + ")");
      }

      svg.append('svg:image')
          .attr('class', 'image')
          .attr('xlink:href', image.src)
          .attr("width", imageWidth)
          .attr("height", imageHeight)

      svg.on('mousemove', function () {
          let xy = d3.mouse(this);
          _this.currentMouseXY = {
              x: xy[0] - (width || imageWidth),
              y: xy[1]
          };
      });

      // We initially generate a SVG group to keep our brushes' DOM elements in:
      var gBrushes = svg.append('g')
        .attr("class", "brushes");
      _this.gBrushes = gBrushes;

      _this.svg = svg;
      // 右键菜单
      if (_this.config.hasOwnProperty('onContextMenuRender')) {
        _this.initContextMenu();
      }

      _this.newBrush(true);
      _this.drawBrushes();
      // _this.setData(_this.config.data);
    }
  }
  // 初始化右键菜单
  initContextMenu() {
    // 初始化右键菜单
    this.contextmenu = new Contextmenu({
      render: this.config.onContextMenuRender.bind(this),
      container: this.config.imageDiv,
      onClick: (nodeInfo, iteminfo) => {
        if (this.config.contextmenuClick) {
            this.config.contextmenuClick.call(this, nodeInfo, iteminfo);
        }
      }
    });
  }
  /* CREATE NEW BRUSH
   *
   * This creates a new brush. A brush is both a function (in our array) and a set of predefined DOM elements
   * Brushes also have selections. While the selection are empty (i.e. a suer hasn't yet dragged)
   * the brushes are invisible. We will add an initial brush when this viz starts. (see end of file)
   * Now imagine the user clicked, moved the mouse, and let go. They just gave a selection to the initial brush.
   * We now want to create a new brush.
   * However, imagine the user had simply dragged an existing brush--in that case we would not want to create a new one.
   * We will use the selection of a brush in brushend() to differentiate these cases.
   */
   // 创建新刷子
  newBrush(isInit = false) {
    let _this = this;
    var brush = d3.brush()
      .on("start", brushstart)
      .on("brush", onbrush)
      .on("end", brushend);
    brush.handleSize(2)

    // 判断是否允许编辑标注信息
    brush.filter(() => {
      return this.config.enableBrush;
    })

    this.brush = brush;

    if (isInit) {
      if (_this.config.data.length > 0) {
        _this.config.data.forEach(data => {
          // brushes.push({ id: data.id, brush: brush });
          brushes.push({ id: data.id, brush: brush });
        })
      } else {
        // brushes.push({ id: brushes.length, brush: brush });
        brushes.push({ id: utils.genUUID(), brush: brush });
      }
    } else {
      // brushes.push({ id: brushes.length, brush: brush });
        brushes.push({ id: utils.genUUID(), brush: brush });
    }

    function brushstart() {
      // your stuff here
    };

    function onbrush() {
      // your stuff here
      _this.contextmenu && _this.contextmenu.hide();
    }

    function brushend() {
      // Figure out if our latest brush has a selection
      var lastBrushID = brushes[brushes.length - 1].id;
      var lastBrush = document.getElementById('brush-' + lastBrushID);
      var selection = d3.brushSelection(lastBrush);

      // If it does, that means we need another one
      if (selection && selection[0] !== selection[1]) {
        _this.newBrush();
      }

      // Always draw brushes
      _this.drawBrushes();
    }
  }

  // 绘制刷子
  drawBrushes() {
    let _this = this;
    var brushSelection = this.gBrushes
      .selectAll('.brush')
      .data(brushes, function (d) { return d.id });

      // Set up new brushes
    brushSelection.enter()
      .insert("g", '.brush')
      .attr('class', 'brush')
      .attr('id', function(brush) { return "brush-" + brush.id; })
      .each(function(brushObject) {
        //call the brush
        brushObject.brush(d3.select(this));
        // 初始化已有的Brush
        let initBrush = _this.config.data.find((data) => {
          return data.id == brushObject.id;
        })
        if (initBrush) {
          brushObject.brush.move(d3.select(this), [[parseInt(initBrush.axis.xmin), parseInt(initBrush.axis.ymin)], [parseInt(initBrush.axis.xmax), parseInt(initBrush.axis.ymax)]]);
        }
      });

      /* REMOVE POINTER EVENTS ON BRUSH OVERLAYS
       *
       * This part is abbit tricky and requires knowledge of how brushes are implemented.
       * They register pointer events on a .overlay rectangle within them.
       * For existing brushes, make sure we disable their pointer events on their overlay.
       * This frees the overlay for the most current (as of yet with an empty selection) brush to listen for click and drag events
       * The moving and resizing is done with other parts of the brush, so that will still work.
       */
    brushSelection
      .each(function (brushObject) {
        d3.select(this)
          .attr('class', 'brush')
          .selectAll('.overlay')
          .style('pointer-events', function() {
            var brush = brushObject.brush;
            let brushIndex = 0;
            for (var i = 0; i < brushes.length; i++) {
              let brush = brushes[i];
              if (brush.id == brushObject.id) {
                brushIndex = i;
                break;
              }
            }
            if (brushIndex === brushes.length-1 && brush !== undefined) {
              return 'all';
            } else {
              return 'none';
            }
          });
          // 增加图片缩放处理
          if (_this.scale != 0) {
            let strokeWidth = Math.max(1/_this.scale, 1)
            d3.select(this).attr("stroke-width", strokeWidth);
          }
      })

    // 绑定右键菜单
    brushSelection.on('contextmenu', function (brushObj) {
      // d3.event.stopImmediatePropagation();
      if (_this.config.hasOwnProperty('onContextMenuRender')) {
        let gBursh = document.getElementById('brush-' + brushObj.id);
        let gSelection = gBursh.children[1];
        if (gSelection.getAttribute("style") != "display: none;") {
          d3.event.preventDefault();

          // 获取最新的鼠标位置
          let xy = d3.mouse(this);
          _this.currentMouseXY = {
              x: xy[0] - _this.width,
              y: xy[1]
          };
          _this.contextmenu.show(brushObj, _this.currentMouseXY);
        }
      }
    })

    brushSelection.exit()
      .remove();
  }

  // 设置标注信息, 此方法可能有BUG，慎用！！！！！！
  setData(datas = []) {
    let _this = this;
    if (datas.length > 0) {
      datas.forEach(data => {
        _this.gBrushes.call(_this.brush).call(_this.brush.move,
           [[parseInt(data.axis.xmin), parseInt(data.axis.ymin)], [parseInt(data.axis.xmax), parseInt(data.axis.ymax)]]);
        _this.newBrush();
        _this.drawBrushes();
      })
    }
  }

  // 获取标注信息
  getBrushes() {
    let datas = [];
    brushes.forEach((brush) => {
      let gBursh = document.getElementById('brush-' + brush.id);
      // let gSelection = d3.brushSelection(gBursh);
      let gSelection = gBursh.children[1];
      if (gSelection.getAttribute("style") != "display: none;") {
        let x = Number(gSelection.getAttribute("x"));
        let y = Number(gSelection.getAttribute("y"));
        let width = Number(gSelection.getAttribute("width"));
        let height = Number(gSelection.getAttribute("height"));

        datas.push({
          id:brush.id,
          axis:{
            xmin:x, //gSelection[0][0],
            ymin:y, // gSelection[0][1],
            xmax:width + x, // gSelection[1][0],
            ymax:height + y // gSelection[1][1]
          }
        });
      }
    })
    return datas;
  }

  // 删除指定ID的刷子
  deleteBrush(brushId) {
    let brushIndex = -1;
    for (var i = 0; i < brushes.length; i++) {
      let brush = brushes[i];
      if (brush.id == brushId) {
        brushIndex = i;
        break;
      }
    }
    if (brushIndex < 0) {
        return false;
    }

    // if (this.config.hasOwnProperty('onDeleteNode')) {
    //     if (!this.config.onDeleteNode(node)) {
    //         return;
    //     }
    // }

    brushes.splice(brushIndex, 1);
    d3.select('#brush-' + brushId).remove();
  }
}

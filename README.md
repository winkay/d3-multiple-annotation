```
	import Annotation from './Annotation.js'
	let config = {
		imageUrl:"http://www.czx318.com/upfile/13900243981432884431.jpg",
		imageDiv:"#imageDiv",
		data:[],
		onContextMemuRender:(nodeINfo) => {
			return [{ label:"删除", action:"delete"}]
		},
		contextmenuClick: (node, action) => {
			if (action.action == "delete") {
				this.annotation.delete(node.id);
			}
		}
	}
	this.annotation = new Annotation(config);
	this.annotation.init();
```
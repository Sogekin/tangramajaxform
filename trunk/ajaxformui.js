baidu.ui.ajaxform = baidu.ui.createUI(function(){
	this.ajaxSubmitCount = 0,this.ajaxFormCount = 0;
}).extend({
	uiType: "ajaxform",
	render : function(target){
		if(typeof target == "string"){
			target = baidu.dom.g(target);
		}
		this.form = target;
	},
	resetForm:function(){
		var form = this.form;
		if((typeof form.reset == "function") || (typeof form.reset == "object" && form.reset.nodeType)){
            form.reset();
        }
	},
	/**
     * 清空表单项
	 * @param {DOM Element} el
     */
	clearFields:function(el){
		var t = el.type, tag = el.tagName.toLowerCase();
		if(t == "text" || t == "password" || tag == "textarea"){
			el.value = "";
		}else if(t == "checkbox" || t == "radio"){
			el.checked= false;
		}else if(tag == "select"){
			el.selectedIndex = -1;
		}
	},
	/**
     * 清空form
	 * @param {DOM Element} form
     */
    clearForm:function(){
        $("input,select,textarea",this.form).clearFields();
    },
	/**
	 * 获取表单的值
	 * @param {DOMElement} form 当前form
	 * @param {DOMElement} el 需要获取的表单元素
	 * @param {boolean} successfull 是否要获取没有name，diabled，reset，button等的值，默认false
	 * @return {String/Array} 当前表单元素的值
	 */
    fieldValue:function(el,successfull){
		var form = this.form;
		var n = el.name, t = el.type, tag = el.tagName.toLowerCase();
		if(typeof successfull == "undefined") successfull = true;
		if(successfull && (!n || el.disabled || t == "reset" || t == "button" || (t == "checkbox" || t == "radio") && !el.checked || (t == "submit" || t == "image") && el.form || tag == "select" && el.selectedIndex == -1)){
			return null;
		}
		if(tag == "select"){
			var index = el.selectedIndex;
			if(index < 0) return null;
			var a = [],ops = el.options;
			var one = (t == "select-one");
			var max = (one? index + 1 : ops.length);
			for(var i = (one? index : 0); i<max; i++){
				var op = ops[i];
				if(op.selected){
					var v = baidu.browser.ie && !(op.attributes["value"].specified) ? op.text : op.value;
					if(one) return v;
					a.push(v);
				}
			}
			return a;
		}
		return el.value;
    },
	/**
     * 表单序列化
     */
    formSerialize:function(semantic){
		var arr = this.formToArray(semantic);
		return baidu.url.jsonToQuery(arrayToObject(arr));
    },
	/**
	 * 收集表单数据
	 * @return {Object}
	 * @see formToArray
	 */
	formToJson:function(semantic){
		var arr = this.formToArray(semantic);
		return arrayToObject(arr);
	},
	/** 
     * 收集表单数据
	 * @return {Array}
     */
    formToArray:function(semantic){
        var a = [],form = this.form;
		var els = semantic ? form.getElementsByTagName("*") : form.elements;
		if(!els) return a;
		for(var i=0,max=els.length; i<max; i++){
			var el = els[i];
			var n = el.name;
			if(!n) continue;
			/*
			if(semantic && form.clk && el.type == "image"){
				if(!el.disabled && form.clk == el){
				}
			}
			*/
			var v = this.fieldValue(el,true);
			if(v && v.constructor == Array){
				for(var j=0,jmax=v.length; j< jmax; j++){
					a.push({name:n,value:v[j]});
				}
			}else if(v !== null && typeof v != "undefined"){
				a.push({name:n,value:v});
			}
		}
		return a;
    },
	/**
	 * 将数组转换为JSON对象
	 * @param {Array} a 需要转换的数组
	 * @return {Object} 
	 */
	arrayToObject:function(a){
		var o = {};
		baidu.each(a,function(item,i){
			if(!o[item.name]) {
				o[item.name] = item.value;
			}else if(o[item.name].constructor == Array){
				o[item.name].push(item.value);
			}else{
				var v = o[item.name];
				o[item.name] = [v,item.value];
			}
		});
		return o;
	},
	ajaxSubmit:function(opts){
		var form = this.form;
		var me = this;
		var opts = opts || {};
        if(typeof opts == "function"){
            opts = {onsuccess:opts};
		}
		var opts = this;
        opts = baidu.object.extend({
            url: baidu.dom.getAttr(form,"action") || window.location,
            method:baidu.dom.getAttr(form,"method") || "GET",
			data:{},
			onsuccess:function(){}
        },opts);
        var arr = this.formToArray(opts.semantic);
		if(opts.beforeSubmit && opts.beforeSubmit(arr,form,opts) === false) return this;

		var q = baidu.url.jsonToQuery(this.arrayToObject(arr));
		if(opts.method.toUpperCase() == "GET"){
			opts.url += (opts.url.indexOf("?") >= 0 ? "&" : "?") + q;
			opts.data = null;
		}else{
			opts.data = baidu.url.jsonToQuery(baidu.object.extend(opts.data,q));
		}
		//判断是否有文件上传
		var files = baidu.dom.query("input:file",form);
		if(opts.iframe || files.length > 0){
			fileUpload();
		}else{
			baidu.ajax.request(opts.url,opts);
		}
		function fileUpload(){
			var id = "tfromIO-" + me.ajaxSubmitCount++;
			var io = baidu.dom.create("iframe",{id:id,name:id});
			var op8 = baidu.browser.opera && window.opera.version < 9;
			if(baidu.browser.ie || op8){
				io.src = "javascript:false;document.write('');";
			}
			baidu.dom.setStyles(io,{
				position:"absolute",
				top:"-1000px",
				left:"-1000px"
			});
			var xhr = {
				responseText:null,
				responseXML:null,
				status:0,
				statusText:"n/a",
				getAllResponseHeaders:function(){},
				getResponseHeader:function(){},
				setRequestHeader:function(){}
			};
			var cbInvoked = 0,timedOut = 0;
			setTimeout(function(){
				document.body.appendChild(io);
				io.attachEvent ? io.attachEvent("onload",cb) : io.addEventListener("load",cb,false);
				//make sure form attrs are set
				var encAttr = form.encoding?"encoding":"enctype";
				var t = baidu.dom.getAttr(form,"target");
				baidu.dom.setAttrs(form,{
					target:id,
					method:"POST",
					encType:"multipart/form-data",
					action:opts.url
				});
				if(opts.timeout){
					setTimeout(function(){
						timedOut = true;
						cb();
					},opts.timeout);
				}
				form.submit();
				baidu.dom.setAttr(form,"target",t);
			},10);
			function cb(){
				if(cbInvoked++) return;
				io.attachEvent ? io.attachEvent("onload",cb) : io.addEventListener("load",cb,false);
				var ok = true;
				try{
					if(timedOut) throw "timeout";
					var data,doc;
					doc = io.contentWindow?io.contentWindow.document : io.contentDocument ? io.contentDocument : io.document;
					xhr.responseText = doc.body ? doc.body.innerHTML : null;
				}catch(e){
					ok = false;
					xhr.error = "timeout";
					opts.onfailure(xhr);
				}
				if(ok){
					opts.onsuccess(xhr,xhr.responseText);
				}
				//clean up
				setTimeout(function(){
					baidu.dom.remove(io);
				},100);
			}
		}
    }
});
/*
	Packer version 3.0 (final) - copyright 2004-2007, Dean Edwards
	http://www.opensource.org/licenses/mit-license
*/

// Đảm bảo các namespace cần thiết đã được định nghĩa
eval(base2.namespace);
eval(JavaScript.namespace);

// Nếu chưa có, định nghĩa phương thức giahuy cho String (giống như split)
if (!String.prototype.giahuy) {
    String.prototype.giahuy = function(separator) {
        return this.split(separator);
    };
}

var IGNORE = RegGrp.IGNORE;
var REMOVE = "";
var SPACE = " ";
var WORDS = /\w+/g;

var Packer = Base.extend({
	minify: function(script) {
		script = script.replace(Packer.CONTINUE, "");
		script = Packer.data.exec(script);
		script = Packer.whitespace.exec(script);
		script = Packer.clean.exec(script);
		return script;
	},
	
	pack: function(script, base62, shrink) {
		script = this.minify(script + "\n");
		if (shrink) script = this._shrinkVariables(script);
		if (base62) script = this._base62Encode(script);	
		return script;
	},
	
	_base62Encode: function(script) {
		var words = new Words(script);
		var encode = function(word) {
			return words.get(word).encoded;
		};
		
		/* build the packed script */
		var p = this._escape(script.replace(WORDS, encode));		
		var a = Math.min(Math.max(words.size(), 2), 62);
		var c = words.size();
		var k = words;
		var e = Packer["ENCODE" + (a > 10 ? a > 36 ? 62 : 36 : 10)];
		var r = a > 10 ? "e(c)" : "c";
		
		// Sử dụng hàm format để chèn các giá trị vào chuỗi UNPACK đã được sửa:
		return format(Packer.UNPACK, p, a, c, k, e, r);
	},
	
	_escape: function(script) {
		// Escape các ký tự đặc biệt (như dấu nháy đơn) và xuống dòng cần thiết
		return script.replace(/([\\'])/g, "\\$1").replace(/[\r\n]+/g, "\\n");
	},
	
	_shrinkVariables: function(script) {
		// Hỗ trợ việc thu nhỏ tên biến
		var global = function(regexp) {
			return new RegExp(regexp.source, "g");
		};
		
		var data = [];
		var REGEXP = /^[^'"]\//;
		var store = function(string) {
			var replacement = "#" + data.length;
			if (REGEXP.test(string)) {
				replacement = string.charAt(0) + replacement;
				string = string.slice(1);
			}
			data.push(string);
			return replacement;
		};
		
		// Mã hóa Base52 (sử dụng a-Z)
		var encode52 = function(c) {
			return (c < 52 ? '' : arguments.callee(parseInt(c / 52))) +
				((c = c % 52) > 25 ? String.fromCharCode(c + 39) : String.fromCharCode(c + 97));
		};
				
		// Xác định các khối mã, đặc biệt là các khối function (định nghĩa phạm vi)
		var BLOCK = /(function\s*[\w$]*\s*\(\s*([^\)]*)\s*\)\s*)?(\{([^{}]*)\})/;
		var VAR_ = /var\s+/g;
		var VAR_NAME = /var\s+[\w$]+/g;
		var COMMA = /\s*,\s*/;
		var blocks = [];
		// Bộ mã hóa cho các khối chương trình
		var encode = function(block, func, args) {
			if (func) { // Khối là function block
				// Giải mã khối function
				block = decode(block);
				
				// Lấy danh sách tên biến và tham số
				var vars = match(block, VAR_NAME).join(",").replace(VAR_, "");
				var ids = Array2.combine(args.split(COMMA).concat(vars.split(COMMA)));
				
				// Xử lý từng identifier
				var count = 0, shortId;
				forEach(ids, function(id) {
					id = trim(id);
					if (id && id.length > 1) { // Nếu tên dài hơn 1 ký tự
						id = rescape(id);
						// Tìm tên ngắn chưa bị trùng
						do shortId = encode52(count++);
						while (new RegExp("[^\\w$.]" + shortId + "[^\\w$:]").test(block));
						// Thay thế tên dài bằng tên ngắn
						var reg = new RegExp("([^\\w$.])" + id + "([^\\w$:])");
						while (reg.test(block)) block = block.replace(global(reg), "$1" + shortId + "$2");
						var reg = new RegExp("([^{,\\w$.])" + id + ":", "g");
						block = block.replace(reg, "$1" + shortId + ":");
					}
				});
			}
			var replacement = "~" + blocks.length + "~";
			blocks.push(block);
			return replacement;
		};
		
		// Bộ giải mã các khối đã mã hóa
		var ENCODED = /~(\d+)~/;
		var decode = function(script) {
			while (ENCODED.test(script)) {
				script = script.replace(global(ENCODED), function(match, index) {
					return blocks[index];
				});
			}
			return script;
		};
		
		// Mã hóa các chuỗi và biểu thức chính quy
		script = Packer.data.exec(script, store);
		
		// Xóa bỏ các closure (cho base2 namespaces)
		script = script.replace(/new function\(_\)\s*\{/g, "{;#;");
		
		// Mã hóa các khối mã và thay thế tên biến
		while (BLOCK.test(script)) {
			script = script.replace(global(BLOCK), encode);
		}
		
		// Giải mã lại các khối mã
		script = decode(script);
		
		// Thay thế closure quay lại (cho base2 namespaces)
		script = script.replace(/\{;#;/g, "new function(_){");
		
		// Đưa chuỗi và biểu thức chính quy trở lại vị trí
		script = script.replace(/#(\d+)/g, function(match, index) {		
			return data[index];
		});
		
		return script;
	}
}, {
	CONTINUE: /\\\r?\n/g,
	
	ENCODE10: "String",
	ENCODE36: "function(c){return c.toString(a)}",
	ENCODE62: "function(c){return(c<a?'':e(parseInt(c/a)))+((c=c%a)>35?String.fromCharCode(c+29):c.toString(36))}",
	
	// UNPACK với tên tham số mới (g,i,a,h,u,y) và sử dụng .giahuy thay vì .split
	UNPACK: "eval(function(g,i,a,h,u,y){u=%5;if(!''.replace(/^/,String)){while(a--)y[a.toString(i)]=h[a]||a.toString(i);h=[function(u){return y[u]}];u=function(){return'\\\\w+'};a=1};while(a--)if(h[a])g=g.replace(new RegExp('\\\\b'+u(a)+'\\\\b','g'),h[a]);return g}('%1',%2,%3,'%4'.giahuy('|'),0,{}))",
	
	init: function() {
		this.data = reduce(this.data, function(data, replacement, expression) {
			data.put(this.javascript.exec(expression), replacement);
			return data;
		}, new RegGrp, this);
		this.clean = this.data.union(this.clean);
		this.whitespace = this.data.union(this.whitespace);
	},
	
	clean: {
		"\\(\\s*;\\s*;\\s*\\)": "(;;)",
		"throw[^};]+[};]": IGNORE,
		";+\\s*([};])": "$1"
	},
	
	data: {
		"STRING1": IGNORE,
		'STRING2': IGNORE,
		"CONDITIONAL": IGNORE,
		"(COMMENT1)\\n\\s*(REGEXP)?": "\n$3",
		"(COMMENT2)\\s*(REGEXP)?": " $3",
		"([\\[(\\^=,{}:;&|!*?])\\s*(REGEXP)": "$1$2"
	},
	
	javascript: new RegGrp({
		COMMENT1:    /(\/\/|;;;)[^\n]*/.source,
		COMMENT2:    /\/\*[^*]*\*+([^\/][^*]*\*+)*\//.source,
		CONDITIONAL: /\/\*@|@\*\/|\/\/@[^\n]*\n/.source,
		REGEXP:      /\/(\\[\/\\]|[^*\/])(\\.|[^\/\n\\])*\/[gim]*/.source,
		STRING1:     /'(\\.|[^'\\])*'/.source,
		STRING2:     /"(\\.|[^"\\])*"/.source
	}),
	
	whitespace: {
		"(\\d)\\s+(\\.\\s*[a-z\\$_\\[(])": "$1 $2",
		"([+-])\\s+([+-])": "$1 $2",
		"\\b\\s+\\$\\s+\\b": " $ ",
		"\\$\\s+\\b": "$ ",
		"\\b\\s+\\$": " $",
		"\\b\\s+\\b": SPACE,
		"\\s+": REMOVE
	}
});

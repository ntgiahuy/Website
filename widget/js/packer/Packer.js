/*
	Packer version 3.0 (final) - copyright 2004-2007, Dean Edwards
	http://www.opensource.org/licenses/mit-license
*/

eval(base2.namespace);
eval(JavaScript.namespace);

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
		// Sử dụng biến u thay cho e, và biến y thay cho r.
		var u = Packer["ENCODE" + (a > 10 ? a > 36 ? 62 : 36 : 10)];
		var r = a > 10 ? "u(c)" : "c";
		
		return format(Packer.UNPACK, p, a, c, k, u, r);
	},
	
	_escape: function(script) {
		// single quotes wrap the final string so escape them
		// also escape new lines required by conditional comments
		return script.replace(/([\\'])/g, "\\$1").replace(/[\r\n]+/g, "\\n");
	},
	
	_shrinkVariables: function(script) {
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
		
		// Base52 encoding (a-Z)
		var encode52 = function(c) {
			return (c < 52 ? '' : arguments.callee(parseInt(c / 52))) +
				((c = c % 52) > 25 ? String.fromCharCode(c + 39) : String.fromCharCode(c + 97));
		};
				
		// Identify blocks, particularly function blocks (which define scope)
		var BLOCK = /(function\s*[\w$]*\s*\(\s*([^\)]*)\s*\)\s*)?(\{([^{}]*)\})/;
		var VAR_ = /var\s+/g;
		var VAR_NAME = /var\s+[\w$]+/g;
		var COMMA = /\s*,\s*/;
		var blocks = [];
		// Encoder cho các block
		var encode = function(block, func, args) {
			if (func) {
				// Decode function block để có thể xử lý các biến bên trong
				block = decode(block);
				var vars = match(block, VAR_NAME).join(",").replace(VAR_, "");
				var ids = Array2.combine(args.split(COMMA).concat(vars.split(COMMA)));
				var count = 0, shortId;
				forEach(ids, function(id) {
					id = trim(id);
					if (id && id.length > 1) {
						id = rescape(id);
						do shortId = encode52(count++);
						while (new RegExp("[^\\w$.]" + shortId + "[^\\w$:]").test(block));
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
		
		var ENCODED = /~(\d+)~/;
		var decode = function(script) {
			while (ENCODED.test(script)) {
				script = script.replace(global(ENCODED), function(match, index) {
					return blocks[index];
				});
			}
			return script;
		};
		
		script = Packer.data.exec(script, store);
		script = script.replace(/new function\(_\)\s*\{/g, "{;#;");
		while (BLOCK.test(script)) {
			script = script.replace(global(BLOCK), encode);
		}
		script = decode(script);
		script = script.replace(/\{;#;/g, "new function(_){");
		script = script.replace(/#(\d+)/g, function(match, index) {
			return data[index];
		});
		return script;
	}
}, {
	CONTINUE: /\\\r?\n/g,
	
	ENCODE10: "String",
	ENCODE36: "function(c){return c.toString(a)}",
	// Sửa ENCODE62: sử dụng u thay vì e và i thay cho a (theo thứ tự của wrapper mới)
	ENCODE62: "function(c){return(c<i?'':u(parseInt(c/i)))+((c=c%i)>35?String.fromCharCode(c+29):c.toString(36))}",
	
	// Đã sửa UNPACK để sử dụng tham số mới (g,i,a,h,u,y) và đảm bảo không còn tham chiếu tới e hoặc r.
	UNPACK: "eval(function(g,i,a,h,u,y){u=function(c){return(c<i?'':u(parseInt(c/i)))+((c=c%i)>35?String.fromCharCode(c+29):c.toString(36))};if(!''.replace(/^/,String)){while(a--)y[a.toString(i)]=h[a]||a.toString(i);h=[function(u){return y[u]}];u=function(){return'\\\\w+'};a=1};while(a--)if(h[a])g=g.replace(new RegExp('\\\\b'+u(a)+'\\\\b','g'),h[a]);return g}('%1',%2,%3,'%4'.split('|'),0,{}))",
	
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

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
        
        /* Build the packed script */
        var p = this._escape(script.replace(WORDS, encode));        
        var a = Math.min(Math.max(words.size(), 2), 62);
        var c = words.size();
        var k = words;
        var e = Packer["ENCODE" + (a > 10 ? a > 36 ? 62 : 36 : 10)];
        var r = a > 10 ? "e(c)" : "c";
        
        return format(Packer.UNPACK, p, a, c, k, e, r);
    },
    
    _escape: function(script) {
        // Dùng dấu nháy đơn bao quanh chuỗi kết quả, nên escape các ký tự cần thiết
        return script.replace(/([\\'])/g, "\\$1").replace(/[\r\n]+/g, "\\n");
    },
    
    _shrinkVariables: function(script) {
        // Vì Windows Scripting Host không cho phép regexp.test() trên regex toàn cục,
        // ta tạo phiên bản toàn cục của các regex cần thiết.
        var global = function(regexp) {
            return new RegExp(regexp.source, "g");
        };
        
        var data = []; // Lưu trữ các chuỗi đã encode (string và regex)
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
            return (c < 52 ? '' : encode52(parseInt(c / 52))) +
                ((c = c % 52) > 25 ? String.fromCharCode(c + 39) : String.fromCharCode(c + 97));
        };
                
        // Xác định các block, đặc biệt là các block hàm (function blocks) định nghĩa scope
        var BLOCK = /(function\s*[\w$]*\s*\(\s*([^\)]*)\s*\)\s*)?(\{([^{}]*)\})/;
        var VAR_ = /var\s+/g;
        var VAR_NAME = /var\s+[\w$]+/g;
        var COMMA = /\s*,\s*/;
        var blocks = []; // Lưu trữ các block chương trình (nội dung giữa dấu {})
        
        // Encoder cho các block
        var encode = function(block, func, args) {
            if (func) {
                // Giải mã block hàm, sau đó sẽ tái phân tích để thu gọn tên biến
                block = decode(block);
                var vars = match(block, VAR_NAME).join(",").replace(VAR_, "");
                var ids = Array2.combine(args.split(COMMA).concat(vars.split(COMMA)));
                var count = 0, shortId;
                forEach(ids, function(id) {
                    id = trim(id);
                    if (id && id.length > 1) {
                        id = rescape(id);
                        do {
                            shortId = encode52(count++);
                        } while (new RegExp("[^\\w$.]" + shortId + "[^\\w$:]").test(block));
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
        
        // Decoder cho các block
        var ENCODED = /~(\d+)~/;
        var decode = function(script) {
            while (ENCODED.test(script)) {
                script = script.replace(global(ENCODED), function(match, index) {
                    return blocks[index];
                });
            }
            return script;
        };
        
        // Encode chuỗi và regex
        script = Packer.data.exec(script, store);
        
        // Loại bỏ closure (dành cho namespace của base2)
        script = script.replace(/new function\(_\)\s*\{/g, "{;#;");
        
        // Encode các block, đồng thời thay thế tên biến và tham số
        while (BLOCK.test(script)) {
            script = script.replace(global(BLOCK), encode);
        }
        
        // Khôi phục các block đã encode
        script = decode(script);
        
        // Khôi phục closure (cho base2 namespaces)
        script = script.replace(/\{;#;/g, "new function(_){");
        
        // Khôi phục chuỗi và regex
        script = script.replace(/#(\d+)/g, function(match, index) {        
            return data[index];
        });
        
        return script;
    }
}, {
    CONTINUE: /\\\r?\n/g,
    
    ENCODE10: "String",
    ENCODE36: "function(c){return c.toString(i)}",
    ENCODE62: "function(c){return(c<i?'':u(parseInt(c/i)))+((c=c%i)>35?String.fromCharCode(c+29):c.toString(36))}",
    
    UNPACK: "eval(function(g,i,a,h,u,y){u=%5;if(!''.replace(/^/,String)){while(a--)y[%6]=h[a]"+
            "||%6;h=[function(u){return y[u]}];u=function(){return'\\\\w+'};a=1};while(a--)if(h[a])g=g."+
            "replace(new RegExp('\\\\b'+u(a)+'\\\\b','g'),h[a]);return g}('%1',%2,%3,'%4'.split('|'),0,{}))",
    
    // Các biểu thức chính quy dưới đây dùng để loại bỏ khoảng trắng, comment, ... trong mã
    data: /([\s\S]*)/,       
    whitespace: /\s+/g, 
    clean: /\/\*[\s\S]*?\*\/|\/\/.*?(\r?\n)/g
});

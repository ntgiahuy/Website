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
        // Ép kiểu script thành chuỗi nếu chưa phải
        script = String(script);
        // Loại bỏ ký tự xuống dòng nối (line continuation)
        script = script.replace(Packer.CONTINUE, "");
        // Thực hiện loại bỏ hoặc xử lý các dữ liệu nếu cần (theo biểu thức chính quy)
        // Ở đây dùng replace với regex và nhóm bắt (nếu có) để giữ lại nội dung
        script = script.replace(Packer.data, "$1");
        // Rút gọn khoảng trắng
        script = script.replace(Packer.whitespace, " ");
        // Xóa comment kiểu /* */ và //...
        script = script.replace(Packer.clean, "");
        return script;
    },
    
    pack: function(script, base62, shrink) {
        // Đảm bảo script là chuỗi
        script = String(script);
        // Thêm ký tự xuống dòng và thực hiện minify
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
        
        /* Xây dựng mã nén dựa trên từ điển */
        var p = this._escape(script.replace(WORDS, encode));
        // i: cơ số (số lượng từ, tối thiểu 2, tối đa 62)
        var i = Math.min(Math.max(words.size(), 2), 62);
        // a: tổng số từ được phát hiện
        var a = words.size();
        // h: đối tượng từ (Words collection)
        var h = words;
        // u: hàm mã hóa dựa trên cơ số (ENCODE10, ENCODE36 hoặc ENCODE62)
        var u = Packer["ENCODE" + (i > 10 ? i > 36 ? 62 : 36 : 10)];
        // r: chuỗi thay thế cho các từ (dạng “u(c)” nếu cơ số lớn hơn 10, ngược lại “c”)
        var r = i > 10 ? "u(c)" : "c";
        
        // Gọi hàm format (được định nghĩa bên ngoài) để chèn các giá trị vào mẫu UNPACK
        return format(Packer.UNPACK, p, i, a, h, u, r);
    },
    
    _escape: function(script) {
        // Vì chuỗi cuối cùng được bao bởi dấu nháy đơn nên escape các ký tự \ và '
        // Đồng thời escape các ký tự xuống dòng để đảm bảo chuỗi nằm trên một dòng
        return script.replace(/([\\'])/g, "\\$1").replace(/[\r\n]+/g, "\\n");
    },
    
    _shrinkVariables: function(script) {
        // Hàm helper tạo phiên bản toàn cục của RegExp
        var global = function(regexp) {
            return new RegExp(regexp.source, "g");
        };
        
        var data = []; // Mảng lưu trữ các chuỗi (string và regex) đã encode
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
        
        // Hàm mã hóa Base52 (sử dụng a-z và A-Z)
        var encode52 = function(c) {
            return (c < 52 ? '' : encode52(parseInt(c / 52))) +
                ((c = c % 52) > 25 ? String.fromCharCode(c + 39) : String.fromCharCode(c + 97));
        };
                
        // Regex xác định các block của hàm (function blocks)
        var BLOCK = /(function\s*[\w$]*\s*\(\s*([^\)]*)\s*\)\s*)?(\{([^{}]*)\})/;
        var VAR_ = /var\s+/g;
        var VAR_NAME = /var\s+[\w$]+/g;
        var COMMA = /\s*,\s*/;
        var blocks = [];
        
        // Hàm encode cho các block: thay thế các tên biến dài thành tên biến ngắn
        var encode = function(block, func, args) {
            if (func) {
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
        
        // Hàm decode phục hồi các block đã encode
        var ENCODED = /~(\d+)~/;
        var decode = function(script) {
            while (ENCODED.test(script)) {
                script = script.replace(global(ENCODED), function(match, index) {
                    return blocks[index];
                });
            }
            return script;
        };
        
        // Encode các chuỗi và regex bằng cách sử dụng store
        script = script.replace(Packer.data, store);
        // Loại bỏ closure (dành cho namespace của base2)
        script = script.replace(/new function\(_\)\s*\{/g, "{;#;");
        // Encode các block, đồng thời thu gọn tên biến trong block
        while (BLOCK.test(script)) {
            script = script.replace(global(BLOCK), encode);
        }
        // Khôi phục các block đã encode
        script = decode(script);
        // Khôi phục lại closure (cho base2 namespaces)
        script = script.replace(/\{;#;/g, "new function(_){");
        // Khôi phục các chuỗi và regex đã được lưu trong mảng data
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
    
    data: /([\s\S]*)/,
    whitespace: /\s+/g, 
    clean: /\/\*[\s\S]*?\*\/|\/\/.*?(\r?\n)/g
});

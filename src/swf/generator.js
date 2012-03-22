/* -*- mode: javascript; tab-width: 4; insert-tabs-mode: nil; indent-tabs-mode: nil -*- */

var defaultTemplateSet = [
  readSi8, readSi16, readSi32, readUi8, readUi16, readUi32, readFixed,
  readFixed8, readFloat16, readFloat, readDouble, readEncodedU32, readBool,
  align, readSb, readUb, readFb, readString, readBinary
];

var rtemplate = /^function\s*(.*)\s*\(([^)]*)\)\s*{\s*([\s\S]*.)\s*}$/;
var rinlinable = /^return\s*([^;]*)$/;

function generateParser(struct) {
  var productions = [];
  var varCount = 0;

  (function produce(struct, context) {
    if (typeof struct !== 'object' || '$' in struct) {
      struct = { $$: struct };
      context = undefined;
    } else if (!context) {
      context = '$' + varCount++;
    }

    var production = [];
    for (var field in struct) {
      var type = struct[field];
      if (typeof type === 'object' && type.$ != undefined) {
        assert(!isArray(type.$), 'invalid type', 'generate');
        var options = type;
        type = options.$;
      } else {
        var options = { };
      }

      var merge = false;
      var hide = false;
      var refer = false;
      if (field[0] === '$') {
        if (+field[1] == field[1]) {
          assert(typeof type === 'object', 'can only merge structs', 'generate');
          merge = true;
          hide = true;
        } else {
          refer = true;
          if (field[1] === '$')
            hide = true;
        }
        field = field.replace(/^\$\$?\d*/, '');
      }
      var segment = [];
      if (field) {
        if (refer)
          segment.push('var ' + field + '=');
        if (!hide)
          segment.push(context + '.' + field + '=');
      }

      if (options.count || 'length' in options || options.condition) {
        if (refer) {
          var listVar = field;
        } else {
          var listVar = '$' + varCount++;
          segment.unshift('var ' + listVar + '=');
        }
        segment.push('[]');
        if (options.count) {
          var countVar = '$' + varCount++;
          segment.push('var ' + countVar + '=' + options.count);
          segment.push('while(' + countVar + '--){');
        } else if ('length' in options) {
          var endVar = '$' + varCount++;
          var length = options.length;
          if (length <= 0)
            length = '$stream.remaining()+' + length;
          segment.push('var ' + endVar + '=$stream.pos+' + length + '');
          segment.push('while($stream.pos<' + endVar + '){');
        } else {
          segment.push('do{');
        }
        var obj = produce(type);
        if (obj) {
          segment.push('var ' + obj + '={}');
          segment.push(productions.pop());
          segment.push(listVar + '.push(' + obj + ')}');
        } else {
          segment.push(listVar + '.push(');
          segment.push(productions.pop());
          segment.push(')}');
        }
        if (options.condition)
          segment.push('while(' + options.condition + ')');
      } else {
        switch (typeof type) {
        case 'number':
          var template = defaultTemplateSet[type];
          assert(template, 'unknown type', 'generate');
          if (typeof template === 'function') {
            var terms = rtemplate.exec(template);
            var name = terms[1];
            var params = terms[2].split(', ');
            var body = terms[3].split('\n');
            var inline = true;
            var argc = params.length - 2;
            if (argc) {
              var args = options.args;
              assert(args && args.length >= argc, 'missing arguments', 'generate');
              params.splice(2, args.length, args);
              inline = false;
            }
            if (inline && rinlinable.test(body))
              type = RegExp.$1;
            else
              type = name + '(' + params.join(',') + ')';
          } else {
            type = template;
          }
        case 'string':
          segment.push(type);
          break;
        case 'object':
          var shared = segment.splice(0).join('');

          function branch(struct) {
            var obj = produce(struct, merge ? context : refer && field);
            var init = shared;
            if (!merge && obj) {
              if (!(refer || hide))
                init = 'var ' + obj + '=' + init;
              init += '{}';
            }
            segment.push(init);
            segment.push(productions.pop());
          }

          if (isArray(type)) {
            var expr = type[0];
            assert(expr, 'invalid control expression', 'generate');
            var branches = type[1];
            assert(typeof branches === 'object', 'invalid alternatives', 'generate');
            if (isArray(branches)) {
              assert(branches.length <= 2, 'too many alternatives', 'generate');
              segment.push('if(' + expr + '){');
              branch(branches[0]);
              segment.push('}');
              if (branches[1]) {
                segment.push('else{');
                branch(branches[1]);
                segment.push('}');
              }
            } else {
              var values = keys(branches);
              assert(values != false, 'missing case values', 'generate');
              segment.push('switch(' + expr + '){');
              var val;
              var i = 0;
              while (val = values[i++]) {
                if (val !== 'unknown') {
                  segment.push('case ' + val + ':');
                  if (branches[val] != branches[values[i]]) {
                    branch(branches[val]);
                    segment.push('break');
                  }
                }
              }
              segment.push('default:');
              if ('unknown' in branches)
                branch(branches.unknown);
              segment.push('}');
            }
          } else {
            branch(type);
          }
          break;
        default:
          fail('invalid type', 'generate');
        }
      }
      push.apply(production, segment);
    }
    productions.push(production.join('\n'));
    return context;
  })(struct, '$');
  
  var args = ['$bytes', '$stream', '$'];
  if (arguments.length > 1)
    push.apply(args, slice.call(arguments, 1));
  return eval(
    '(function(' + args.join(',') + '){\n' +
      '$||($={})\n' +
      productions.join('\n') + '\n' +
      'return $\n' +
    '})'
  );
}

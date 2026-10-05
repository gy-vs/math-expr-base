// test parser

import assert from 'assert'

import { approxEqual } from '../../../tools/approx.js'
import math from '../../../src/defaultInstance.js'
const Parser = math.Parser

describe('parser', function () {
  it('should create a parser', function () {
    const parser = new Parser()
    assert.ok(parser instanceof Parser)
  })

  it('should have a property isParser', function () {
    const a = new Parser()
    assert.strictEqual(a.isParser, true)
  })

  it('should have a property type', function () {
    const a = new Parser()
    assert.strictEqual(a.type, 'Parser')
  })

  it('should evaluate an expression', function () {
    const parser = new Parser()

    const result = parser.evaluate('2 + 3')
    assert.strictEqual(result, 5)
  })

  it('should evaluate a list with expressions', function () {
    const parser = new Parser()

    const result = parser.evaluate(['a = 2', 'a + 3'])
    assert.deepStrictEqual(result, [2, 5])
  })

  it('should get variables from the parsers namespace ', function () {
    const parser = new Parser()

    parser.evaluate('a = 3')
    parser.evaluate('b = a + 2')
    assert.strictEqual(parser.evaluate('a'), 3)
    assert.strictEqual(parser.evaluate('b'), 5)
    assert.strictEqual(parser.get('a'), 3)
    assert.strictEqual(parser.get('b'), 5)
  })

  it('should get all variables from the parsers namespace ', function () {
    const parser = new Parser()

    parser.evaluate('a = 3')
    parser.evaluate('b = a + 2')
    assert.deepStrictEqual(parser.getAll(), { a: 3, b: 5 })

    parser.remove('a')
    assert.deepStrictEqual(parser.getAll(), { b: 5 })
  })

  it('should return undefined when getting a non existing variable', function () {
    const parser = new Parser()

    assert.strictEqual(parser.get('non_existing_variable'), undefined)
  })

  it('should set variables in the parsers namespace ', function () {
    const parser = new Parser()

    assert.strictEqual(parser.set('a', 3), 3)
    assert.strictEqual(parser.evaluate('a'), 3)
    assert.strictEqual(parser.evaluate('a + 2'), 5)

    // adjust variable
    assert.strictEqual(parser.evaluate('a = a + 2'), 5)
    assert.strictEqual(parser.evaluate('a'), 5)
    assert.strictEqual(parser.get('a'), 5)

    assert.strictEqual(parser.set('a', parser.get('a') - 4), 1)
    assert.strictEqual(parser.evaluate('a'), 1)
  })

  it('should remove a variable from the parsers namespace ', function () {
    const parser = new Parser()

    assert.strictEqual(parser.set('qq', 3), 3)
    assert.strictEqual(parser.evaluate('qq'), 3)
    assert.strictEqual(parser.get('qq'), 3)

    parser.remove('qq')
    assert.strictEqual(parser.get('qq'), undefined)
    assert.throws(function () { parser.evaluate('qq') })

    assert.strictEqual(parser.evaluate('ww = 5'), 5)
    assert.strictEqual(parser.get('ww'), 5)
    parser.remove('ww')
    assert.strictEqual(parser.get('ww'), undefined)
    assert.throws(function () { parser.evaluate('ww') })
  })

  it('should clear the parsers namespace ', function () {
    const parser = new Parser()

    assert.strictEqual(parser.evaluate('xx = yy = zz = 5'), 5)

    assert.strictEqual(parser.set('pi', 'oops'), 'oops')

    assert.strictEqual(parser.get('xx'), 5)
    assert.strictEqual(parser.get('yy'), 5)
    assert.strictEqual(parser.get('zz'), 5)
    assert.strictEqual(parser.get('pi'), 'oops')

    assert.strictEqual(parser.evaluate('xx'), 5)
    assert.strictEqual(parser.evaluate('yy'), 5)
    assert.strictEqual(parser.evaluate('zz'), 5)
    assert.strictEqual(parser.evaluate('pi'), 'oops')

    parser.clear()

    assert.strictEqual(parser.get('xx'), undefined)
    assert.strictEqual(parser.get('yy'), undefined)
    assert.strictEqual(parser.get('zz'), undefined)
    approxEqual(parser.get('pi'), undefined)

    assert.throws(function () { parser.evaluate('xx') })
    assert.throws(function () { parser.evaluate('yy') })
    assert.throws(function () { parser.evaluate('zz') })
    assert.strictEqual(parser.evaluate('pi'), Math.PI)
  })

  it('should validate variable names', function () {
    const parser = new Parser()

    // Valid variable names
    assert.strictEqual(parser.set('validVar', 42), 42)
    assert.strictEqual(parser.evaluate('validVar'), 42)
    assert.strictEqual(parser.set('_underscoreVar', 10), 10)
    assert.strictEqual(parser.evaluate('_underscoreVar'), 10)
    assert.strictEqual(parser.set('var123', 100), 100)
    assert.strictEqual(parser.evaluate('var123'), 100)

    // Invalid variable names
    assert.throws(() => parser.set('123var', 5), /Invalid variable name/)
    assert.throws(() => parser.set('var-with-hyphen', 5), /Invalid variable name/)
    assert.throws(() => parser.set('var with space', 5), /Invalid variable name/)
    assert.throws(() => parser.set('@specialChar', 5), /Invalid variable name/)
  })

  describe('security', function () {
    it('should return undefined when accessing what appears to be inherited properties', function () {
      try {
        const parser = new Parser()

        Object.prototype.foo = 'bar' // eslint-disable-line no-extend-native

        parser.clear()
        assert.strictEqual(parser.get('foo'), undefined)
        // No longer uses a Object scope, so this now works!
        // assert.throws(function () { parser.get('foo') }, /No access/)
      } finally {
        delete Object.prototype.foo
      }
    })

    it('should throw an error when assigning an inherited property', function () {
      try {
        const parser = new Parser()
        // We can safely set within the parser
        assert.strictEqual(parser.set('toString', null), null)
        // But getting it out via getAll() will throw.
        assert.throws(function () { parser.getAll() }, /No access/)
      } finally {
        delete Object.prototype.foo
      }
    })
  })

  it('should throw an exception when creating a parser without new', function () {
    assert.throws(function () { Parser() }, /Constructor must be called with the new operator/)
  })

  describe('JSON serialization', function () {
    it('should JSON.stringify a parser with its variables and functions', function () {
      const parser = new Parser()
      parser.evaluate('k = 3')
      parser.evaluate('f(x) = x^2 + k')

      const json = JSON.parse(JSON.stringify(parser))

      assert.deepStrictEqual(json, {
        mathjs: 'Parser',
        scope: {
          k: 3,
          f: {
            mathjs: 'FunctionAssignmentNode',
            name: 'f',
            params: [{ name: 'x', type: 'any' }],
            expr: json.scope.f.expr
          }
        }
      })
      assert.strictEqual(json.scope.f.expr.mathjs, 'OperatorNode')
    })

    it('should serialize units, matrices, and big numbers with type info', function () {
      const parser = new Parser()
      parser.evaluate('L = 3 cm')
      parser.evaluate('M = [1, 2; 3, 4]')
      parser.evaluate('b = bignumber("0.1")')

      const json = JSON.parse(JSON.stringify(parser))

      assert.strictEqual(json.scope.L.mathjs, 'Unit')
      assert.strictEqual(json.scope.M.mathjs, 'DenseMatrix')
      assert.strictEqual(json.scope.b.mathjs, 'BigNumber')
      assert.strictEqual(json.scope.b.value, '0.1')
    })

    it('should restore a parser via JSON.parse with math.reviver', function () {
      const parser = new Parser()
      parser.evaluate('k = 3')
      parser.evaluate('f(x) = x^2 + k')
      parser.evaluate('h(x) = f(x) * 2')

      const restored = JSON.parse(JSON.stringify(parser), math.reviver)

      assert.ok(restored instanceof Parser)
      assert.strictEqual(restored.evaluate('f(2)'), 7)
      assert.strictEqual(restored.evaluate('h(2)'), 14)
    })

    it('should restore variables with their original types', function () {
      const parser = new Parser()
      parser.evaluate('L = 3 cm')
      parser.evaluate('M = [1, 2; 3, 4]')
      parser.evaluate('b = bignumber("0.1")')

      const restored = JSON.parse(JSON.stringify(parser), math.reviver)

      assert.ok(restored.get('L') instanceof math.Unit)
      assert.strictEqual(restored.get('L').toString(), '3 cm')
      assert.ok(restored.get('M') instanceof math.Matrix)
      assert.deepStrictEqual(restored.get('M').toArray(), [[1, 2], [3, 4]])
      assert.ok(restored.get('b') instanceof math.BigNumber)
      assert.strictEqual(restored.get('b').toString(), '0.1')
    })

    it('should restore functions that call other restored functions', function () {
      const parser = new Parser()
      parser.evaluate('a = 10')
      parser.evaluate('f(x) = x + a')
      parser.evaluate('g(x) = f(x) * 2')
      parser.evaluate('h(x) = g(x) - 1')

      const restored = JSON.parse(JSON.stringify(parser), math.reviver)

      assert.strictEqual(restored.evaluate('h(5)'), 29)
    })

    it('should restore recursive functions', function () {
      const parser = new Parser()
      parser.evaluate('fib(n) = n < 2 ? n : fib(n - 1) + fib(n - 2)')

      const restored = JSON.parse(JSON.stringify(parser), math.reviver)

      assert.strictEqual(restored.evaluate('fib(10)'), 55)
    })

    it('should restore an empty parser', function () {
      const restored = JSON.parse(JSON.stringify(new Parser()), math.reviver)

      assert.ok(restored instanceof Parser)
      assert.deepStrictEqual(restored.getAll(), {})
      assert.strictEqual(restored.evaluate('2 + 3'), 5)
    })

    it('should keep the restored parser independent of the original', function () {
      const parser = new Parser()
      parser.evaluate('k = 3')
      parser.evaluate('f(x) = x + k')

      const restored = JSON.parse(JSON.stringify(parser), math.reviver)
      restored.evaluate('z = 9')
      restored.evaluate('k = 100')

      assert.strictEqual(parser.get('z'), undefined)
      assert.strictEqual(parser.get('k'), 3)
      assert.strictEqual(parser.evaluate('f(2)'), 5)
      assert.strictEqual(restored.evaluate('f(2)'), 102)
    })

    it('should restore a parser via the static Parser.fromJSON', function () {
      const parser = new Parser()
      parser.evaluate('k = 3')
      parser.evaluate('f(x) = x^2 + k')

      const restored = Parser.fromJSON(JSON.parse(JSON.stringify(parser)))

      assert.ok(restored instanceof Parser)
      assert.strictEqual(restored.evaluate('f(2)'), 7)
    })

    it('should revive mathjs types nested in objects and arrays', function () {
      const parser = new Parser()
      parser.evaluate('o = {u: 2 m, c: [1, 2; 3, 4]}')

      const restored = Parser.fromJSON(JSON.parse(JSON.stringify(parser)))

      assert.ok(restored.get('o').u instanceof math.Unit)
      assert.ok(restored.get('o').c instanceof math.Matrix)
    })

    it('should round-trip special numbers like Infinity', function () {
      const parser = new Parser()
      parser.set('inf', Infinity)

      const restored = JSON.parse(JSON.stringify(parser), math.reviver)

      assert.strictEqual(restored.get('inf'), Infinity)
    })

    it('should throw a descriptive error for a native JavaScript function', function () {
      const parser = new Parser()
      parser.set('helper', function (x) {
        return x + 1
      })

      assert.throws(function () {
        JSON.stringify(parser)
      }, /Cannot serialize parser: function "helper" is a native JavaScript function/)
    })

    it('should not throw for functions assigned via the expression parser', function () {
      const parser = new Parser()
      parser.evaluate('f(x) = x + 1')

      assert.doesNotThrow(function () {
        JSON.stringify(parser)
      })
    })

    it('should throw when fromJSON receives an invalid object', function () {
      assert.throws(function () {
        Parser.fromJSON({})
      }, /Cannot parse JSON: expected an object with \{ mathjs: "Parser" \}/)
    })
  })
})

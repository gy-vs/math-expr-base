import { factory } from '../utils/factory.js'
import { createEmptyMap, toObject } from '../utils/map.js'
import { functionAssignmentNode } from './node/FunctionAssignmentNode.js'

const name = 'Parser'
const dependencies = ['evaluate', 'parse', 'replacer', 'reviver']

export const createParserClass = /* #__PURE__ */ factory(name, dependencies, ({ evaluate, parse, replacer, reviver }) => {
  /**
   * @constructor Parser
   * Parser contains methods to evaluate or parse expressions, and has a number
   * of convenience methods to get, set, and remove variables from memory. Parser
   * keeps a scope containing variables in memory, which is used for all
   * evaluations.
   *
   * Methods:
   *    const result = parser.evaluate(expr)  // evaluate an expression
   *    const value = parser.get(name)        // retrieve a variable from the parser
   *    const values = parser.getAll()        // retrieve all defined variables
   *    parser.set(name, value)               // set a variable in the parser
   *    parser.remove(name)                   // clear a variable from the
   *                                          // parsers scope
   *    parser.clear()                        // clear the parsers scope
   *
   * Example usage:
   *    const parser = new Parser()
   *    // Note: there is a convenience method which can be used instead:
   *    // const parser = new math.parser()
   *
   *    // evaluate expressions
   *    parser.evaluate('sqrt(3^2 + 4^2)')        // 5
   *    parser.evaluate('sqrt(-4)')               // 2i
   *    parser.evaluate('2 inch in cm')           // 5.08 cm
   *    parser.evaluate('cos(45 deg)')            // 0.7071067811865476
   *
   *    // define variables and functions
   *    parser.evaluate('x = 7 / 2')              // 3.5
   *    parser.evaluate('x + 3')                  // 6.5
   *    parser.evaluate('f(x, y) = x^y')          // f(x, y)
   *    parser.evaluate('f(2, 3)')                // 8
   *
   *    // get and set variables and functions
   *    const x = parser.get('x')                 // 3.5
   *    const f = parser.get('f')                 // function
   *    const g = f(3, 2)                         // 9
   *    parser.set('h', 500)
   *    const i = parser.evaluate('h / 2')        // 250
   *    parser.set('hello', function (name) {
   *        return 'hello, ' + name + '!'
   *    })
   *    parser.evaluate('hello("user")')          // "hello, user!"
   *
   *    // clear defined functions and variables
   *    parser.clear()
   *
   */
  function Parser () {
    if (!(this instanceof Parser)) {
      throw new SyntaxError(
        'Constructor must be called with the new operator')
    }

    Object.defineProperty(this, 'scope', {
      value: createEmptyMap(),
      writable: false
    })
  }

  /**
   * Attach type information
   */
  Parser.prototype.type = 'Parser'
  Parser.prototype.isParser = true

  /**
   * Parse and evaluate the given expression
   * @param {string | string[]} expr   A string containing an expression,
   *                                   for example "2+3", or a list with expressions
   * @return {*} result     The result, or undefined when the expression was empty
   * @throws {Error}
   */
  Parser.prototype.evaluate = function (expr) {
    // TODO: validate arguments
    return evaluate(expr, this.scope)
  }

  /**
   * Get a variable (a function or variable) by name from the parsers scope.
   * Returns undefined when not found
   * @param {string} name
   * @return {* | undefined} value
   */
  Parser.prototype.get = function (name) {
    // TODO: validate arguments
    if (this.scope.has(name)) {
      return this.scope.get(name)
    }
  }

  /**
   * Get a map with all defined variables
   * @return {Object} values
   */
  Parser.prototype.getAll = function () {
    return toObject(this.scope)
  }

  /**
   * Get a map with all defined variables
   * @return {Map} values
   */
  Parser.prototype.getAllAsMap = function () {
    return this.scope
  }

  function isValidVariableName (name) {
    if (name.length === 0) { return false }

    for (let i = 0; i < name.length; i++) {
      const cPrev = name.charAt(i - 1)
      const c = name.charAt(i)
      const cNext = name.charAt(i + 1)
      const valid = parse.isAlpha(c, cPrev, cNext) || (i > 0 && parse.isDigit(c))

      if (!valid) {
        return false
      }
    }

    return true
  }

  /**
   * Set a symbol (a function or variable) by name from the parsers scope.
   * @param {string} name
   * @param {* | undefined} value
   */
  Parser.prototype.set = function (name, value) {
    if (!isValidVariableName(name)) {
      throw new Error(`Invalid variable name: '${name}'. Variable names must follow the specified rules.`)
    }
    this.scope.set(name, value)
    return value
  }

  /**
   * Remove a variable from the parsers scope
   * @param {string} name
   */
  Parser.prototype.remove = function (name) {
    this.scope.delete(name)
  }

  /**
   * Clear the scope with variables and functions
   */
  Parser.prototype.clear = function () {
    this.scope.clear()
  }

  /**
   * Get a JSON representation of the parser, containing all variables and
   * functions in the parsers scope with their mathjs type information.
   *
   * Functions defined via the expression parser (for example `f(x) = x^2`)
   * are serialized as their `FunctionAssignmentNode`. Plain JavaScript
   * functions inserted via `parser.set(name, fn)` cannot be serialized:
   * an error is thrown mentioning the name of such a function.
   *
   * The representation can be read back using
   * `JSON.parse(text, math.reviver)`, which returns a Parser instance, or
   * manually using `Parser.fromJSON(JSON.parse(text))`.
   *
   * @returns {Object} Returns a JSON object structured as:
   *                   `{"mathjs": "Parser", "scope": {...}}`
   * @throws {Error} when the scope contains a non-serializable JavaScript
   *                 function inserted via `parser.set`
   */
  Parser.prototype.toJSON = function () {
    const scope = {}

    this.scope.forEach(function (value, key) {
      if (typeof value === 'function') {
        const node = value[functionAssignmentNode]
        if (node) {
          scope[key] = node
        } else {
          throw new Error('Cannot serialize parser: function "' + key +
            '" is a native JavaScript function and cannot be converted to JSON')
        }
      } else {
        scope[key] = value
      }
    })

    // Normalize the scope into plain JSON: invokes the toJSON methods of
    // mathjs types (Unit, BigNumber, nodes, ...) and handles values like
    // Infinity via the replacer.
    const jsonScope = JSON.parse(JSON.stringify(scope, replacer))

    return {
      mathjs: 'Parser',
      scope: jsonScope
    }
  }

  /**
   * Instantiate a Parser from a JSON object as returned by
   * {@link Parser#toJSON}. The plain JSON object passed in (for example the
   * result of `JSON.parse(text)`) is revived in place: mathjs data types
   * (Unit, BigNumber, ...) and expression nodes in the scope are restored.
   * @param {Object} json  a JSON object structured as:
   *                        `{"mathjs": "Parser", "scope": {...}}`
   * @return {Parser}
   */
  Parser.fromJSON = function (json) {
    if (!json || json.mathjs !== 'Parser' || !json.scope) {
      throw new Error('Cannot parse JSON: expected an object with {' +
        ' mathjs: "Parser" }')
    }

    // revive mathjs types (Unit, BigNumber, ...) and expression nodes in
    // the scope, including values nested in objects and arrays. The replacer
    // is needed in case values were already revived (for example when
    // fromJSON is invoked by math.reviver), so values like Infinity survive
    // the intermediate stringify.
    const scope = JSON.parse(JSON.stringify(json.scope, replacer), reviver)

    const parser = new Parser()
    const functionNodes = []

    Object.keys(scope).forEach(function (key) {
      const value = scope[key]

      if (value && value.isFunctionAssignmentNode) {
        // restore functions in a second pass so all variables and the
        // functions they depend on are in the scope first
        functionNodes.push([key, value])
      } else {
        parser.scope.set(key, value)
      }
    })

    functionNodes.forEach(function (entry) {
      const key = entry[0]
      const node = entry[1]
      // compile and evaluate the assignment, binding it to this parser
      node.compile().evaluate(parser.scope)
      // the node's own name can differ from the key in the scope;
      // bind the compiled function to the scope key instead
      if (key !== node.name) {
        parser.scope.set(key, parser.scope.get(node.name))
        parser.scope.delete(node.name)
      }
    })

    return parser
  }

  return Parser
}, { isClass: true })

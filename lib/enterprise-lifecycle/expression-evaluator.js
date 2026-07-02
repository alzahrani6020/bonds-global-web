/**
 * Safe Expression Evaluator for Lifecycle Gate Expressions
 *
 * Supports: identifiers, numbers, strings, booleans, comparison, logic,
 * arithmetic, parentheses, and helper functions (present, empty, len, contains).
 * Does NOT use eval() or Function constructor.
 */

function getPath(obj, path) {
  if (!path) return undefined;
  const parts = String(path).split('.');
  let cur = obj;
  for (const part of parts) {
    if (cur == null) return undefined;
    cur = cur[part];
  }
  return cur;
}

function isPresent(value) {
  if (value === undefined || value === null) return false;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === 'object') return Object.keys(value).length > 0;
  if (typeof value === 'string') return value.trim().length > 0;
  return true;
}

const TOKEN_SPEC = [
  { type: 'NUMBER', regex: /^\d+(?:\.\d+)?/ },
  { type: 'STRING', regex: /^'([^']*)'/ },
  { type: 'STRING', regex: /^"([^"]*)"/ },
  { type: 'BOOL', regex: /^(true|false)\b/ },
  { type: 'AND', regex: /^&&/ },
  { type: 'OR', regex: /^\|\|/ },
  { type: 'EQ', regex: /^==/ },
  { type: 'NEQ', regex: /^!=/ },
  { type: 'LTE', regex: /^<=/ },
  { type: 'GTE', regex: /^>=/ },
  { type: 'LT', regex: /^</ },
  { type: 'GT', regex: /^>/ },
  { type: 'NOT', regex: /^!/ },
  { type: 'PLUS', regex: /^\+/ },
  { type: 'MINUS', regex: /^-/ },
  { type: 'MUL', regex: /^\*/ },
  { type: 'DIV', regex: /^\// },
  { type: 'MOD', regex: /^%/ },
  { type: 'LPAREN', regex: /^\(/ },
  { type: 'RPAREN', regex: /^\)/ },
  { type: 'COMMA', regex: /^,/ },
  { type: 'IDENT', regex: /^[a-zA-Z_][a-zA-Z0-9_.]*/ },
  { type: 'SKIP', regex: /^\s+/ }
];

function tokenize(expression) {
  const tokens = [];
  let input = String(expression || '').trim();
  while (input.length) {
    let matched = false;
    for (const spec of TOKEN_SPEC) {
      const m = input.match(spec.regex);
      if (m) {
        if (spec.type !== 'SKIP') {
          const value = spec.type === 'STRING' ? m[1] : m[0];
          tokens.push({ type: spec.type, value });
        }
        input = input.slice(m[0].length);
        matched = true;
        break;
      }
    }
    if (!matched) {
      throw new Error(`Unexpected token at: ${input.slice(0, 20)}`);
    }
  }
  tokens.push({ type: 'EOF', value: '' });
  return tokens;
}

class Parser {
  constructor(tokens) {
    this.tokens = tokens;
    this.pos = 0;
  }

  current() {
    return this.tokens[this.pos];
  }

  eat(expectedType) {
    const token = this.current();
    if (token.type !== expectedType) {
      throw new Error(`Expected ${expectedType} but got ${token.type}`);
    }
    this.pos++;
    return token;
  }

  parse() {
    const node = this.parseOr();
    if (this.current().type !== 'EOF') {
      throw new Error(`Unexpected token ${this.current().type}`);
    }
    return node;
  }

  parseOr() {
    let node = this.parseAnd();
    while (this.current().type === 'OR') {
      this.eat('OR');
      node = { type: 'binary', op: '||', left: node, right: this.parseAnd() };
    }
    return node;
  }

  parseAnd() {
    let node = this.parseEquality();
    while (this.current().type === 'AND') {
      this.eat('AND');
      node = { type: 'binary', op: '&&', left: node, right: this.parseEquality() };
    }
    return node;
  }

  parseEquality() {
    let node = this.parseComparison();
    while (this.current().type === 'EQ' || this.current().type === 'NEQ') {
      const op = this.current().type === 'EQ' ? '==' : '!=';
      this.eat(this.current().type);
      node = { type: 'binary', op, left: node, right: this.parseComparison() };
    }
    return node;
  }

  parseComparison() {
    const ops = { LT: '<', GT: '>', LTE: '<=', GTE: '>=' };
    let node = this.parseAdditive();
    while (ops[this.current().type]) {
      const op = ops[this.current().type];
      this.eat(this.current().type);
      node = { type: 'binary', op, left: node, right: this.parseAdditive() };
    }
    return node;
  }

  parseAdditive() {
    let node = this.parseMultiplicative();
    while (this.current().type === 'PLUS' || this.current().type === 'MINUS') {
      const op = this.current().type === 'PLUS' ? '+' : '-';
      this.eat(this.current().type);
      node = { type: 'binary', op, left: node, right: this.parseMultiplicative() };
    }
    return node;
  }

  parseMultiplicative() {
    const ops = { MUL: '*', DIV: '/', MOD: '%' };
    let node = this.parseUnary();
    while (ops[this.current().type]) {
      const op = ops[this.current().type];
      this.eat(this.current().type);
      node = { type: 'binary', op, left: node, right: this.parseUnary() };
    }
    return node;
  }

  parseUnary() {
    if (this.current().type === 'NOT') {
      this.eat('NOT');
      return { type: 'unary', op: '!', arg: this.parseUnary() };
    }
    if (this.current().type === 'MINUS') {
      this.eat('MINUS');
      return { type: 'unary', op: '-', arg: this.parseUnary() };
    }
    return this.parsePrimary();
  }

  parsePrimary() {
    const token = this.current();
    if (token.type === 'NUMBER') {
      this.eat('NUMBER');
      return { type: 'literal', value: Number(token.value) };
    }
    if (token.type === 'STRING') {
      this.eat('STRING');
      return { type: 'literal', value: token.value };
    }
    if (token.type === 'BOOL') {
      this.eat('BOOL');
      return { type: 'literal', value: token.value === 'true' };
    }
    if (token.type === 'LPAREN') {
      this.eat('LPAREN');
      const node = this.parseOr();
      this.eat('RPAREN');
      return node;
    }
    if (token.type === 'IDENT') {
      this.eat('IDENT');
      if (this.current().type === 'LPAREN') {
        return this.parseCall(token.value);
      }
      return { type: 'identifier', path: token.value };
    }
    throw new Error(`Unexpected token ${token.type}`);
  }

  parseCall(name) {
    this.eat('LPAREN');
    const args = [];
    if (this.current().type !== 'RPAREN') {
      args.push(this.parseOr());
      while (this.current().type === 'COMMA') {
        this.eat('COMMA');
        args.push(this.parseOr());
      }
    }
    this.eat('RPAREN');
    return { type: 'call', name, args };
  }
}

function evaluate(node, context) {
  switch (node.type) {
    case 'literal':
      return node.value;
    case 'identifier':
      return getPath(context, node.path);
    case 'unary':
      if (node.op === '!') return !evaluate(node.arg, context);
      if (node.op === '-') return -evaluate(node.arg, context);
      throw new Error(`Unknown unary operator ${node.op}`);
    case 'binary': {
      const left = evaluate(node.left, context);
      const right = evaluate(node.right, context);
      switch (node.op) {
        case '+': return Number(left) + Number(right);
        case '-': return Number(left) - Number(right);
        case '*': return Number(left) * Number(right);
        case '/': return Number(right) === 0 ? NaN : Number(left) / Number(right);
        case '%': return Number(left) % Number(right);
        case '==': return left == right; // eslint-disable-line eqeqeq
        case '!=': return left != right; // eslint-disable-line eqeqeq
        case '<': return Number(left) < Number(right);
        case '>': return Number(left) > Number(right);
        case '<=': return Number(left) <= Number(right);
        case '>=': return Number(left) >= Number(right);
        case '&&': return left && right;
        case '||': return left || right;
        default:
          throw new Error(`Unknown binary operator ${node.op}`);
      }
    }
    case 'call': {
      const args = node.args.map(a => evaluate(a, context));
      switch (node.name) {
        case 'present':
          return args.length ? isPresent(args[0]) : false;
        case 'empty':
          return args.length ? !isPresent(args[0]) : true;
        case 'len': {
          const v = args[0];
          if (Array.isArray(v) || typeof v === 'string') return v.length;
          if (v && typeof v === 'object') return Object.keys(v).length;
          return 0;
        }
        case 'contains': {
          const [arr, item] = args;
          if (Array.isArray(arr)) return arr.includes(item);
          if (typeof arr === 'string') return arr.includes(String(item));
          return false;
        }
        default:
          throw new Error(`Unknown function '${node.name}'`);
      }
    }
    default:
      throw new Error(`Unknown node type ${node.type}`);
  }
}

function evaluateExpression(expression, context = {}) {
  const tokens = tokenize(expression);
  const parser = new Parser(tokens);
  const ast = parser.parse();
  return evaluate(ast, context);
}

module.exports = {
  evaluateExpression,
  tokenize,
  Parser,
  getPath,
  isPresent
};

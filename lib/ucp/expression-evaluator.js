/**
 * BONDS UCP Expression Evaluator
 *
 * Safe arithmetic and logical expression evaluator for formula registry.
 * Supports variables, functions, + - * / % ^ comparisons && || ! and parentheses.
 * Does NOT use eval/new Function.
 */

const FUNCTIONS = {
  min: (...args) => Math.min(...args),
  max: (...args) => Math.max(...args),
  sqrt: (x) => Math.sqrt(x),
  pow: (x, y) => Math.pow(x, y),
  abs: (x) => Math.abs(x),
  round: (x) => Math.round(x),
  floor: (x) => Math.floor(x),
  ceil: (x) => Math.ceil(x)
};

function tokenize(expr) {
  const tokens = [];
  const s = String(expr).trim();
  let i = 0;
  while (i < s.length) {
    const c = s[i];
    if (/\s/.test(c)) { i++; continue; }
    if (/[0-9.]/.test(c)) {
      let num = '';
      while (i < s.length && (/[0-9.]/.test(s[i]))) {
        num += s[i];
        i++;
      }
      tokens.push({ type: 'number', value: parseFloat(num) });
      continue;
    }
    if (/[a-zA-Z_]/.test(c)) {
      let name = '';
      while (i < s.length && (/[a-zA-Z0-9_]/.test(s[i]))) {
        name += s[i];
        i++;
      }
      tokens.push({ type: 'ident', value: name });
      continue;
    }
    if (c === '(' || c === ')' || c === ',') {
      tokens.push({ type: 'punct', value: c });
      i++;
      continue;
    }
    // Multi-char operators
    const two = s.slice(i, i + 2);
    if (['>=', '<=', '==', '!=', '&&', '||'].includes(two)) {
      tokens.push({ type: 'op', value: two });
      i += 2;
      continue;
    }
    if ('+-*/%^><!'.includes(c)) {
      tokens.push({ type: 'op', value: c });
      i++;
      continue;
    }
    throw new Error(`Unexpected character: ${c}`);
  }
  return tokens;
}

class Parser {
  constructor(tokens) {
    this.tokens = tokens;
    this.pos = 0;
  }

  peek() { return this.tokens[this.pos]; }
  consume() { return this.tokens[this.pos++]; }
  expect(type, value) {
    const t = this.consume();
    if (!t || t.type !== type || t.value !== value) {
      throw new Error(`Expected ${value}`);
    }
  }

  parse() {
    const result = this.logical();
    if (this.pos < this.tokens.length) throw new Error('Unexpected token at end');
    return result;
  }

  logical() {
    let node = this.equality();
    while (this.peek() && this.peek().type === 'op' && ['&&', '||'].includes(this.peek().value)) {
      const op = this.consume().value;
      const right = this.equality();
      node = { type: 'binary', op, left: node, right };
    }
    return node;
  }

  equality() {
    let node = this.comparison();
    while (this.peek() && this.peek().type === 'op' && ['==', '!='].includes(this.peek().value)) {
      const op = this.consume().value;
      const right = this.comparison();
      node = { type: 'binary', op, left: node, right };
    }
    return node;
  }

  comparison() {
    let node = this.additive();
    while (this.peek() && this.peek().type === 'op' && ['>', '>=', '<', '<='].includes(this.peek().value)) {
      const op = this.consume().value;
      const right = this.additive();
      node = { type: 'binary', op, left: node, right };
    }
    return node;
  }

  additive() {
    let node = this.multiplicative();
    while (this.peek() && this.peek().type === 'op' && ['+', '-'].includes(this.peek().value)) {
      const op = this.consume().value;
      const right = this.multiplicative();
      node = { type: 'binary', op, left: node, right };
    }
    return node;
  }

  multiplicative() {
    let node = this.power();
    while (this.peek() && this.peek().type === 'op' && ['*', '/', '%'].includes(this.peek().value)) {
      const op = this.consume().value;
      const right = this.power();
      node = { type: 'binary', op, left: node, right };
    }
    return node;
  }

  power() {
    let node = this.unary();
    while (this.peek() && this.peek().type === 'op' && this.peek().value === '^') {
      this.consume();
      const right = this.unary();
      node = { type: 'binary', op: '^', left: node, right };
    }
    return node;
  }

  unary() {
    if (this.peek() && this.peek().type === 'op' && ['+', '-', '!'].includes(this.peek().value)) {
      const op = this.consume().value;
      const node = this.unary();
      return { type: 'unary', op, node };
    }
    return this.primary();
  }

  primary() {
    const t = this.peek();
    if (!t) throw new Error('Unexpected end of expression');
    if (t.type === 'number') {
      this.consume();
      return { type: 'number', value: t.value };
    }
    if (t.type === 'ident') {
      const name = this.consume().value;
      if (this.peek() && this.peek().type === 'punct' && this.peek().value === '(') {
        this.consume(); // (
        const args = [];
        if (this.peek() && !(this.peek().type === 'punct' && this.peek().value === ')')) {
          args.push(this.logical());
          while (this.peek() && this.peek().type === 'punct' && this.peek().value === ',') {
            this.consume();
            args.push(this.logical());
          }
        }
        this.expect('punct', ')');
        return { type: 'call', name, args };
      }
      return { type: 'var', name };
    }
    if (t.type === 'punct' && t.value === '(') {
      this.consume();
      const node = this.logical();
      this.expect('punct', ')');
      return node;
    }
    throw new Error(`Unexpected token: ${t.value}`);
  }
}

function toNumber(value) {
  if (typeof value === 'boolean') return value ? 1 : 0;
  return Number(value);
}

function isTruthy(value) {
  return Boolean(value);
}

function evaluate(node, context = {}) {
  switch (node.type) {
    case 'number': return node.value;
    case 'var': {
      if (!(node.name in context)) throw new Error(`Unknown variable: ${node.name}`);
      return toNumber(context[node.name]);
    }
    case 'unary': {
      const v = evaluate(node.node, context);
      if (node.op === '!') return v ? 0 : 1;
      return node.op === '-' ? -v : v;
    }
    case 'binary': {
      const left = evaluate(node.left, context);
      const right = evaluate(node.right, context);
      const l = toNumber(left);
      const r = toNumber(right);
      switch (node.op) {
        case '+': return l + r;
        case '-': return l - r;
        case '*': return l * r;
        case '/':
          if (r === 0) throw new Error('Division by zero');
          return l / r;
        case '%':
          if (r === 0) throw new Error('Modulo by zero');
          return l % r;
        case '^': return Math.pow(l, r);
        case '>': return l > r ? 1 : 0;
        case '>=': return l >= r ? 1 : 0;
        case '<': return l < r ? 1 : 0;
        case '<=': return l <= r ? 1 : 0;
        case '==': return l === r ? 1 : 0;
        case '!=': return l !== r ? 1 : 0;
        case '&&': return (isTruthy(left) && isTruthy(right)) ? 1 : 0;
        case '||': return (isTruthy(left) || isTruthy(right)) ? 1 : 0;
        default: throw new Error(`Unknown operator: ${node.op}`);
      }
    }
    case 'call': {
      const fn = FUNCTIONS[node.name.toLowerCase()];
      if (!fn) throw new Error(`Unknown function: ${node.name}`);
      const args = node.args.map(a => evaluate(a, context));
      return fn(...args);
    }
    default: throw new Error(`Unknown node type: ${node.type}`);
  }
}

function evaluateExpression(expression, context = {}) {
  const tokens = tokenize(expression);
  const parser = new Parser(tokens);
  const ast = parser.parse();
  return evaluate(ast, context);
}

function getVariables(expression) {
  const tokens = tokenize(expression);
  const vars = new Set();
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    if (t.type === 'ident') {
      const next = tokens[i + 1];
      if (next && next.type === 'punct' && next.value === '(') continue; // function call
      vars.add(t.value);
    }
  }
  return Array.from(vars);
}

module.exports = {
  evaluateExpression,
  getVariables,
  FUNCTIONS
};

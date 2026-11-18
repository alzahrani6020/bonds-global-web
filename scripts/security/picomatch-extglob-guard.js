function assertSafeRepeatedExtglob(input) {
  if (typeof input !== 'string') return;
  let repeated = 0;
  let inClass = false;
  const stack = [];
  const deny = () => { throw new SyntaxError('BONDS_UNSAFE_REPEATED_EXTGLOB'); };
  for (let i=0; i<input.length; i++) {
    const c=input[i];
    if (c==='\\') { i++; continue; }
    if (inClass) { if(c===']') inClass=false; continue; }
    if (c==='[') { inClass=true; continue; }
    if (c==='(') {
      let b=i-2;
      while(b>=0 && input[b]==='\\') b--;
      const isRepeated=(input[i-1]==='*' || input[i-1]==='+') && (i-2-b)%2===0;
      if(isRepeated && repeated) deny();
      stack.push(isRepeated);
      if(isRepeated) repeated++;
    } else if(c===')') {
      if(stack.pop()) repeated--;
    } else if(c==='*' && repeated) {
      deny();
    }
  }
  // Unbalanced classes must not hide a wildcard in a repeated group.
  if(inClass && repeated) deny();
}

module.exports={assertSafeRepeatedExtglob};


function factorial(n) {
  var fact = 1;
  for (var i = 1; i <= n; i++) {
    fact = fact * i;
  }
  return fact;
}
x = factorial(3);
console.log(x);


function factorial(n) {
  var fact = 1;
  for (var i = n; i > 0; i--) {
    fact = fact * i;
  }
  return fact;
}
x = factorial(6);
console.log(x);


function factorial(n) {
  var fact = 1;
  if (n == 0 || n == 1) {
    return 1;
  } else {
    fact = n * factorial(n - 1);
    return fact;
  }
}
x = factorial(4);
console.log(x);

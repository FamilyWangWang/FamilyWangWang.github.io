const n={lag:5,rate:.9,peak:40},o={lag:.8,rate:2.2,peak:100};function s(a,t){const e=a.lag+5/a.rate;return a.peak/(1+Math.exp(-a.rate*(t-e)))}export{n as P,o as S,s as a};

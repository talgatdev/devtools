const { compareBigInt } = require("protocol/utils");

function pointEquals(p1, p2) {
  p1 == p2;
}

function pointPrecedes(p1, p2) {
  return compareBigInt(p1, p2) < 0;
}

function pointToString(p) {
  return p;
}

module.exports = {
  pointEquals,
  pointPrecedes,
};

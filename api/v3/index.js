const v3Handler = require('../../v3/api/index.js');

module.exports = async function handler(req, res) {
  return v3Handler(req, res);
};

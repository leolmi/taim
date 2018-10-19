(function(w) {
  /**
   * TAIM
   */

  const default_line_rgx = /(\d+\/\d+\/\d+).*?(\d+).*?(\d+).*?(\w+)/gmi;

  const lines = document.getElementById('lines');
  const line = document.getElementById('line-template').innerHTML;

  w.addLine = function(e) {
    lines.innerHTML += '<br>\n'+line;
  };


})(this);
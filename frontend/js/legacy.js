// Legacy non-module script - no ES module imports
(function() {
  var status = document.getElementById('status');
  status.textContent = 'Script loaded!';
  
  // Test fetch to bridge API
  fetch('/api/health')
    .then(function(r) { return r.json(); })
    .then(function(data) {
      status.textContent = 'Bridge connected: ' + JSON.stringify(data);
    })
    .catch(function(e) {
      status.textContent = 'Bridge error: ' + e.message;
    });
})();

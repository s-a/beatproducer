const Browser = require('zombie');

// We call our test example.com
Browser.localhost('localhost', 3000);

// Load the page from localhost
const browser = new Browser();
browser.visit('/public')
  .then(function() {
    // Fill email, password and submit form
    browser.fill('email', 'zombie@underworld.dead');
    browser.fill('password', 'eat-the-living');
    return browser.pressButton('Sign Me Up!');
  })
  .then(function() {
    // Form submitted, new page loaded.
    browser.assert.success();
    browser.assert.text('title', 'Welcome To Brains Depot');
  });
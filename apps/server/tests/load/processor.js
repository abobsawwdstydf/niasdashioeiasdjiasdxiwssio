/**
 * Artillery Load Test Processor
 * Custom functions for load testing scenarios
 */

module.exports = {
  // Generate random user data
  generateUserData: function (context, events, done) {
    context.vars.randomUsername = `user_${Math.random().toString(36).substring(7)}`;
    context.vars.randomEmail = `${context.vars.randomUsername}@test.com`;
    context.vars.randomPassword = Math.random().toString(36).substring(2, 15);
    return done();
  },

  // Generate random message
  generateMessage: function (context, events, done) {
    const messages = [
      'Hello!',
      'How are you?',
      'Test message',
      'Load testing in progress',
      'This is a test',
      '👋 Hi there!',
      'Random message ' + Math.random(),
    ];
    context.vars.randomMessage = messages[Math.floor(Math.random() * messages.length)];
    return done();
  },

  // Log response time
  logResponseTime: function (requestParams, response, context, ee, next) {
    if (response.timings) {
      console.log(`Response time: ${response.timings.response}ms`);
    }
    return next();
  },

  // Validate response
  validateResponse: function (requestParams, response, context, ee, next) {
    if (response.statusCode >= 500) {
      console.error(`Server error: ${response.statusCode}`);
    }
    return next();
  },

  // Setup WebSocket connection
  setupWebSocket: function (context, events, done) {
    // WebSocket connection logic would go here
    return done();
  },
};

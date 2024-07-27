const request = require('supertest');
const app = require('../backend/server'); // Adjust the path as necessary

describe('User Endpoints', () => {
  let server;

  beforeAll((done) => {
    server = app.listen(4000, (err) => {
      if (err) return done(err);
      done();
    });
  });

  afterAll((done) => {
    server.close(done);
  });

  it('should register a new user', async () => {
    const res = await request(app)
      .post('/register')
      .send({
        email: 'poopdaloop@example.com',
        password: 'password123'
      });
    expect(res.statusCode).toEqual(201);
    expect(res.text).toBe('User registered successfully.');
  });

  it('should not register a user with invalid email', async () => {
    const res = await request(app)
      .post('/register')
      .send({
        email: 'invalid-email',
        password: 'password123'
      });
    expect(res.statusCode).toEqual(400);
  });

  it('should not register a user with short password', async () => {
    const res = await request(app)
      .post('/register')
      .send({
        email: 'test@example.com',
        password: '123'
      });
    expect(res.statusCode).toEqual(400);
  });

  it('should login a user with correct credentials', async () => {
    await request(app)
      .post('/register')
      .send({
        email: 'login@example.com',
        password: 'password123'
      });

    const res = await request(app)
      .post('/login')
      .send({
        email: 'login@example.com',
        password: 'password123'
      });

    expect(res.statusCode).toEqual(200);
    expect(res.text).toBe('Login successful.');
  });

  it('should not login a user with incorrect credentials', async () => {
    const res = await request(app)
      .post('/login')
      .send({
        email: 'nonexistent@example.com',
        password: 'wrongpassword'
      });

    expect(res.statusCode).toEqual(401);
  });

  it('should get a user profile', async () => {
    // First register a user
    await request(app)
      .post('/register')
      .send({
        email: 'profiletest@example.com',
        password: 'password123'
      });

    // Then fetch the profile
    const res = await request(app)
      .get('/profile/profiletest@example.com');

    expect(res.statusCode).toEqual(200);
    expect(res.body).toEqual({});
  });

  it('should update a user profile', async () => {
    // First register a user
    await request(app)
      .post('/register')
      .send({
        email: 'updatetest@example.com',
        password: 'password123'
      });

    // Then update the profile
    const res = await request(app)
      .put('/profile/updatetest@example.com')
      .send({
        profile: {
          fullName: 'Updated Name',
          address1: '123 Main St',
          city: 'Anytown',
          state: 'CA',
          zip: '12345'
        }
      });

    expect(res.statusCode).toEqual(200);
    expect(res.text).toBe('Profile updated successfully.');
  });

  it('should create an event', async () => {
    const res = await request(app)
      .post('/events')
      .send({
        name: 'Test Event',
        description: 'This is a test event',
        location: 'Test Location',
        requiredSkills: ['skill1', 'skill2'],
        urgency: 'High',
        eventDates: ['2024-07-20 to 2024-07-21']
      });
    expect(res.statusCode).toEqual(201);
    expect(res.body).toMatchObject({
      name: 'Test Event',
      description: 'This is a test event',
      location: 'Test Location',
      requiredSkills: ['skill1', 'skill2'],
      urgency: 'High',
      eventDates: ['2024-07-20 to 2024-07-21']
    });
  });

  it('should get all events', async () => {
    const res = await request(app)
      .get('/events');
    expect(res.statusCode).toEqual(200);
    expect(res.body).toBeInstanceOf(Array);
  });

  it('should delete an event', async () => {
    // First create an event
    const eventRes = await request(app)
      .post('/events')
      .send({
        name: 'Delete Event',
        description: 'This event will be deleted',
        location: 'Delete Location',
        requiredSkills: ['skill1', 'skill2'],
        urgency: 'Low',
        eventDates: ['2024-07-22 to 2024-07-23']
      });

    const eventId = eventRes.body.id; // Ensure the ID is captured correctly

    // Then delete the event
    const res = await request(app)
      .delete(`/events/${eventId}`);
    expect(res.statusCode).toEqual(200);
    expect(res.text).toBe('Event deleted successfully.');
  });

  it('should create a notification', async () => {
    const res = await request(app)
      .post('/notifications')
      .send({
        email: 'test@example.com',
        message: 'This is a test notification'
      });
    expect(res.statusCode).toEqual(201);
    expect(res.text).toBe('Notification created successfully.');
  });

  it('should get notifications for a user', async () => {
    const res = await request(app)
      .get('/notifications/test@example.com');
    expect(res.statusCode).toEqual(200);
    expect(res.body).toBeInstanceOf(Array);
  });

  it('should delete a notification', async () => {
    // First create a notification
    const notificationRes = await request(app)
      .post('/notifications')
      .send({
        email: 'deletenotification@example.com',
        message: 'This notification will be deleted'
      });

    const notificationId = notificationRes.body.id; // Ensure the ID is captured correctly

    // Then delete the notification
    const res = await request(app)
      .delete(`/notifications/${notificationId}`);
    expect(res.statusCode).toEqual(200);
    expect(res.text).toBe('Notification deleted successfully.');
  });

  it('should get matching events for a user', async () => {
    // First register a user and update profile with skills and availability
    await request(app)
      .post('/register')
      .send({
        email: 'matchtest@example.com',
        password: 'password123'
      });

    await request(app)
      .put('/profile/matchtest@example.com')
      .send({
        profile: {
          fullName: 'Match Test',
          address1: '123 Main St',
          city: 'Anytown',
          state: 'CA',
          zip: '12345',
          skills: ['skill1', 'skill2'],
          availability: ['2024-07-20 to 2024-07-21']
        }
      });

    // Then create an event
    await request(app)
      .post('/events')
      .send({
        name: 'Matching Event',
        description: 'This event will match',
        location: 'Matching Location',
        requiredSkills: ['skill1'],
        urgency: 'High',
        eventDates: ['2024-07-20 to 2024-07-21']
      });

    // Then get matching events
    const res = await request(app)
      .get('/matching-events/matchtest@example.com');
    expect(res.statusCode).toEqual(200);
    expect(res.body).toBeInstanceOf(Array);
    expect(res.body.length).toBeGreaterThan(0);
  });

  it('should match a volunteer to an event', async () => {
    // First register a user and update profile
    await request(app)
      .post('/register')
      .send({
        email: 'volunteermatch@example.com',
        password: 'password123'
      });

    await request(app)
      .put('/profile/volunteermatch@example.com')
      .send({
        profile: {
          fullName: 'Volunteer Match',
          address1: '123 Main St',
          city: 'Anytown',
          state: 'CA',
          zip: '12345',
          skills: ['skill1', 'skill2'],
          availability: ['2024-07-20 to 2024-07-21']
        }
      });

    // Then create an event
    const eventRes = await request(app)
      .post('/events')
      .send({
        name: 'Volunteer Event',
        description: 'This event is for volunteer match',
        location: 'Volunteer Location',
        requiredSkills: ['skill1'],
        urgency: 'High',
        eventDates: ['2024-07-20 to 2024-07-21']
      });

    const eventId = eventRes.body.id;

    // Then match the volunteer to the event
    const res = await request(app)
      .post('/match-volunteer')
      .send({
        email: 'volunteermatch@example.com',
        eventId: eventId
      });

    expect(res.statusCode).toEqual(201);
    expect(res.text).toBe('Volunteer matched to event successfully.');
  });

  it('should not match a volunteer to the same event twice', async () => {
    // Register and match a volunteer
    await request(app)
      .post('/register')
      .send({
        email: 'duplicatevolunteer@example.com',
        password: 'password123'
      });

    await request(app)
      .put('/profile/duplicatevolunteer@example.com')
      .send({
        profile: {
          fullName: 'Duplicate Volunteer',
          address1: '123 Main St',
          city: 'Anytown',
          state: 'CA',
          zip: '12345',
          skills: ['skill1', 'skill2'],
          availability: ['2024-07-20 to 2024-07-21']
        }
      });

    const eventRes = await request(app)
      .post('/events')
      .send({
        name: 'Duplicate Event',
        description: 'This event is for duplicate testing',
        location: 'Duplicate Location',
        requiredSkills: ['skill1'],
        urgency: 'High',
        eventDates: ['2024-07-20 to 2024-07-21']
      });

    const eventId = eventRes.body.id;

    // First match
    await request(app)
      .post('/match-volunteer')
      .send({
        email: 'duplicatevolunteer@example.com',
        eventId: eventId
      });

    // Attempt to match again
    const duplicateMatchRes = await request(app)
      .post('/match-volunteer')
      .send({
        email: 'duplicatevolunteer@example.com',
        eventId: eventId
      });

    expect(duplicateMatchRes.statusCode).toEqual(400);
    expect(duplicateMatchRes.text).toBe('User is already matched to this event.');
  });

  it('should get volunteer history for a user', async () => {
    const res = await request(app)
      .get('/history/volunteermatch@example.com');
    expect(res.statusCode).toEqual(200);
    expect(res.body).toBeInstanceOf(Array);
  });
});

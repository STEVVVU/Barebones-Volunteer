const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const bcrypt = require('bcrypt');
const mysql = require('mysql');
const reportRoutes = require('./reportRoutes');

const app = express();
const port = 3000;

app.use(bodyParser.json());
app.use(cors());
app.use('/api', reportRoutes);

// Create a connection to the database
const db = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: 'password12345',
    database: 'VolunteerManagement'
});

// Connect to the database
db.connect(err => {
    if (err) {
        console.error('Error connecting to the database:', err);
        return;
    }
    console.log('Connected to the MySQL database.');
});

app.use((req, res, next) => {
    req.user = req.headers['x-user-email'];
    next();
});

// Registration endpoint with logging
app.post('/register', (req, res) => {
    const { email, password } = req.body;
    console.log('Registration request received:', { email, password });

    if (!email || !password) {
        console.error('Missing email or password in request.');
        return res.status(400).send('Email and password are required.');
    }

    const saltRounds = 10;

    bcrypt.hash(password, saltRounds, (err, hash) => {
        if (err) {
            console.error('Hashing error:', err);
            return res.status(500).send('Server error.');
        }

        const query = 'INSERT INTO UserCredentials (email, password) VALUES (?, ?)';
        db.query(query, [email, hash], (err, result) => {
            if (err) {
                console.error('Database error:', err);
                if (err.code === 'ER_DUP_ENTRY') {
                    return res.status(400).send('User already exists.');
                } else {
                    return res.status(500).send('Server error.');
                }
            }

            console.log('User registered successfully:', { email });
            res.status(201).send('User registered successfully.');
        });
    });
});

// Login endpoint
app.post('/login', (req, res) => {
    const { email, password } = req.body;
    console.log('Login request received:', { email });

    const query = 'SELECT password FROM UserCredentials WHERE email = ?';
    db.query(query, [email], (err, results) => {
        if (err) {
            console.error('Database error:', err);
            return res.status(500).send('Server error.');
        }

        if (results.length === 0) {
            console.error('Invalid email or password.');
            return res.status(401).send('Invalid email or password.');
        }

        const hashedPassword = results[0].password;
        bcrypt.compare(password, hashedPassword, (err, result) => {
            if (err) {
                console.error('Hash comparison error:', err);
                return res.status(500).send('Server error.');
            }

            if (result) {
                console.log('Login successful:', { email });
                return res.status(200).send('Login successful.');
            } else {
                console.error('Invalid email or password.');
                return res.status(401).send('Invalid email or password.');
            }
        });
    });
});

// Get user profile endpoint
app.get('/profile/:email', (req, res) => {
    const { email } = req.params;
    console.log('Fetching profile for email:', email);

    const query = 'SELECT * FROM UserProfile WHERE user_id = (SELECT id FROM UserCredentials WHERE email = ?)';
    db.query(query, [email], (err, results) => {
        if (err) {
            console.error('Error fetching profile:', err);
            res.status(500).send('Server error.');
        } else if (results.length === 0) {
            res.status(404).send('User not found.');
        } else {
            const profile = {
                user_id: results[0].user_id,
                full_name: results[0].full_name,
                address: results[0].address,
                address2: results[0].address2,
                city: results[0].city,
                state: results[0].state,
                zipcode: results[0].zipcode,
                skills: results[0].skills,
                preferences: results[0].preferences,
                availability_start: results[0].availability_start,
                availability_end: results[0].availability_end
            };
            res.status(200).json(profile);
        }
    });
});

// Update user profile endpoint
app.put('/profile/:email', (req, res) => {
    const { email } = req.params;
    const profile = req.body;
    console.log('Updating profile for email:', email, 'with data:', profile);

    const checkQuery = 'SELECT * FROM UserProfile WHERE user_id = (SELECT id FROM UserCredentials WHERE email = ?)';
    db.query(checkQuery, [email], (err, results) => {
        if (err) {
            console.error('Error checking profile:', err);
            res.status(500).send('Server error.');
        } else if (results.length === 0) {
            const insertQuery = `
                INSERT INTO UserProfile (user_id, full_name, address, address2, city, state, zipcode, skills, preferences, availability_start, availability_end)
                VALUES ((SELECT id FROM UserCredentials WHERE email = ?), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `;
            db.query(insertQuery, [email, profile.full_name, profile.address, profile.address2, profile.city, profile.state, profile.zipcode, profile.skills, profile.preferences, profile.availability_start, profile.availability_end], (err, results) => {
                if (err) {
                    console.error('Error inserting profile:', err);
                    res.status(500).send('Server error.');
                } else {
                    res.status(201).send('Profile created successfully.');
                }
            });
        } else {
            const updateQuery = `
                UPDATE UserProfile
                SET full_name = ?, address = ?, address2 = ?, city = ?, state = ?, zipcode = ?, skills = ?, preferences = ?, availability_start = ?, availability_end = ?
                WHERE user_id = (SELECT id FROM UserCredentials WHERE email = ?)
            `;
            db.query(updateQuery, [profile.full_name, profile.address, profile.address2, profile.city, profile.state, profile.zipcode, profile.skills, profile.preferences, profile.availability_start, profile.availability_end, email], (err, results) => {
                if (err) {
                    console.error('Error updating profile:', err);
                    res.status(500).send('Server error.');
                } else {
                    res.status(200).send('Profile updated successfully.');
                }
            });
        }
    });
});

// Get all user logins endpoint
app.get('/logins', (req, res) => {
    const query = 'SELECT email FROM UserCredentials';
    db.query(query, (err, results) => {
        if (err) {
            console.error('Error fetching user logins:', err);
            res.status(500).send('Server error.');
        } else {
            res.status(200).json(results);
        }
    });
});

app.get('/matching-events/:email', (req, res) => {
    const email = req.params.email;

    const getUserSkillsQuery = `
        SELECT skills 
        FROM UserProfile 
        WHERE user_id = (SELECT id FROM UserCredentials WHERE email = ?)
    `;

    db.query(getUserSkillsQuery, [email], (err, results) => {
        if (err) {
            console.error('Error fetching user skills:', err);
            return res.status(500).send('Server error.');
        }

        if (results.length === 0) {
            return res.status(404).send('User not found.');
        }

        const skills = results[0].skills.split(',');

        // Query to fetch events that match user skills
        const getMatchingEventsQuery = `
            SELECT * 
            FROM EventDetails 
            WHERE FIND_IN_SET(required_skills, ?)
        `;

        db.query(getMatchingEventsQuery, [skills.join(',')], (err, events) => {
            if (err) {
                console.error('Error fetching matching events:', err);
                return res.status(500).send('Server error.');
            }

            res.json(events);
        });
    });
});


// Get all users endpoint
app.get('/users', (req, res) => {
    const query = 'SELECT email FROM UserCredentials';
    db.query(query, (err, results) => {
        if (err) {
            console.error('Error fetching users:', err);
            res.status(500).send('Server error.');
        } else {
            res.status(200).json(results);
        }
    });
});

// Create an event endpoint
app.post('/events', (req, res) => {
    const { name, description, location, requiredSkills, urgency, eventDates } = req.body;
    const [event_start_date, event_end_date] = eventDates[0].split(' to ');

    console.log('Event creation request body:', req.body);

    const query = `INSERT INTO EventDetails (event_name, description, location, required_skills, urgency, event_start_date, event_end_date)
                   VALUES (?, ?, ?, ?, ?, ?, ?)`;

    db.query(query, [name, description, location, requiredSkills.join(','), urgency, event_start_date, event_end_date], (err, results) => {
        if (err) {
            console.error('Error inserting event:', err);
            res.status(500).send('Server error.');
        } else {
            // Create a notification for the event with a blank email
            const notificationQuery = `INSERT INTO Notifications (email, message) VALUES (?, ?)`;
            const message = `A new event "${name}" has been created.`;
            db.query(notificationQuery, ['', message], (err, results) => {
                if (err) {
                    console.error('Error creating notification:', err);
                    res.status(500).send('Server error.');
                } else {
                    res.status(200).send('Event created successfully.');
                }
            });
        }
    });
});

// Get all events endpoint
app.get('/events', (req, res) => {
    const query = 'SELECT * FROM EventDetails';
    db.query(query, (err, results) => {
        if (err) {
            console.error('Error fetching events:', err);
            res.status(500).send('Server error.');
        } else {
            res.status(200).json(results);
        }
    });
});

// Endpoint to delete an event
app.delete('/events/:id', (req, res) => {
    const { id } = req.params;
    const query = 'DELETE FROM EventDetails WHERE event_id = ?';
    db.query(query, [id], (err, results) => {
        if (err) {
            console.error('Error deleting event:', err);
            res.status(500).send('Server error.');
        } else {
            res.status(200).send('Event deleted successfully.');
        }
    });
});

// Match volunteer to event endpoint
app.post('/match-volunteer', (req, res) => {
    const { email, eventId } = req.body;
    const participationStatus = req.body.participationStatus || 'Assigned'; // Default to 'Assigned' if not provided

    const getUserQuery = 'SELECT id FROM UserCredentials WHERE email = ?';
    db.query(getUserQuery, [email], (err, userResults) => {
        if (err) {
            console.error('Error fetching user ID:', err);
            return res.status(500).send('Server error.');
        }

        if (userResults.length === 0) {
            return res.status(404).send('User not found.');
        }

        const userId = userResults[0].id;

        // Check if the user is already matched to the event
        const checkMatchQuery = 'SELECT * FROM VolunteerHistory WHERE user_id = ? AND event_id = ?';
        db.query(checkMatchQuery, [userId, eventId], (err, matchResults) => {
            if (err) {
                console.error('Error checking existing match:', err);
                return res.status(500).send('Server error.');
            }

            if (matchResults.length > 0) {
                return res.status(400).send('User is already matched to this event.');
            }

            // Fetch event details
            const eventQuery = 'SELECT * FROM EventDetails WHERE event_id = ?';
            db.query(eventQuery, [eventId], (err, eventResults) => {
                if (err) {
                    console.error('Error fetching event details:', err);
                    return res.status(500).send('Server error.');
                }

                if (eventResults.length === 0) {
                    return res.status(404).send('Event not found.');
                }

                const event = eventResults[0];

                // Insert volunteer history with event details
                const insertQuery = `
                    INSERT INTO VolunteerHistory 
                    (user_id, event_id, participation_status, event_name, event_description, location, required_skills, urgency, event_start_date, event_end_date)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                `;
                db.query(insertQuery, [userId, eventId, participationStatus, event.event_name, event.description, event.location, event.required_skills, event.urgency, event.event_start_date, event.event_end_date], (err, insertResults) => {
                    if (err) {
                        console.error('Error inserting volunteer history:', err);
                        return res.status(500).send('Server error.');
                    }

                    // Create a notification for the user
                    const notificationMessage = `You have been matched to the event "${event.event_name}".`;
                    const notificationQuery = 'INSERT INTO Notifications (email, message) VALUES (?, ?)';
                    db.query(notificationQuery, [email, notificationMessage], (err, notificationResults) => {
                        if (err) {
                            console.error('Error creating notification:', err);
                            return res.status(500).send('Server error.');
                        }

                        const notificationId = notificationResults.insertId;
                        const userNotificationQuery = 'INSERT INTO UserNotifications (user_id, notification_id) VALUES (?, ?)';
                        db.query(userNotificationQuery, [userId, notificationId], (err, userNotificationResults) => {
                            if (err) {
                                console.error('Error creating user notification:', err);
                                return res.status(500).send('Server error.');
                            }

                            return res.status(201).send('Volunteer matched and notified successfully.');
                        });
                    });
                });
            });
        });
    });
});

// Get volunteer history for a user
app.get('/history/:email', (req, res) => {
    const { email } = req.params;
    const query = `
        SELECT 
            e.event_name,
            e.description AS eventDescription,
            e.location,
            e.required_skills AS requiredSkills,
            e.urgency,
            CONCAT(e.event_start_date, ' to ', e.event_end_date) AS eventDate,
            v.participation_status AS participationStatus
        FROM 
            VolunteerHistory v
        JOIN 
            EventDetails e ON v.event_id = e.event_id
        JOIN
            UserCredentials u ON v.user_id = u.id
        WHERE 
            u.email = ?;
    `;
    db.query(query, [email], (err, results) => {
        if (err) {
            console.error('Error fetching volunteer history:', err);
            res.status(500).send('Server error.');
        } else {
            res.status(200).json(results);
        }
    });
});

// Fetch unread notifications for a user
app.get('/notifications/:email', (req, res) => {
    const { email } = req.params;
    const queryGetUserId = 'SELECT id FROM UserCredentials WHERE email = ?';
    const queryGetUnreadNotifications = `
        SELECT n.* FROM Notifications n
        LEFT JOIN UserNotifications un ON n.id = un.notification_id AND un.user_id = ?
        WHERE un.is_read IS NULL OR un.is_read = FALSE;
    `;

    db.query(queryGetUserId, [email], (err, userResults) => {
        if (err) {
            console.error('Error fetching user ID:', err);
            res.status(500).send('Server error.');
        } else if (userResults.length === 0) {
            console.log('User not found for email:', email);
            res.status(404).send('User not found.');
        } else {
            const userId = userResults[0].id;
            db.query(queryGetUnreadNotifications, [userId], (err, results) => {
                if (err) {
                    console.error('Error fetching notifications:', err);
                    res.status(500).send('Server error.');
                } else {
                    res.status(200).json(results);
                }
            });
        }
    });
});

// Endpoint to mark a notification as read
app.put('/notifications/:email/:id', (req, res) => {
    const { email, id } = req.params;
    const query = 'UPDATE usernotifications SET is_read = 1 WHERE user_id = (SELECT id FROM UserCredentials WHERE email = ?) AND notification_id = ?';
    db.query(query, [email, id], (err, results) => {
        if (err) {
            console.error('Error marking notification as read:', err);
            res.status(500).send('Server error.');
        } else {
            res.status(200).send('Notification marked as read.');
        }
    });
});

// Fetch events a user is already matched to
app.get('/user-matched-events/:email', (req, res) => {
    const { email } = req.params;
    const getUserQuery = 'SELECT id FROM UserCredentials WHERE email = ?';

    db.query(getUserQuery, [email], (err, userResults) => {
        if (err) {
            console.error('Error fetching user ID:', err);
            return res.status(500).send('Server error.');
        }

        if (userResults.length === 0) {
            return res.status(404).send('User not found.');
        }

        const userId = userResults[0].id;

        const matchedEventsQuery = 'SELECT event_id FROM VolunteerHistory WHERE user_id = ?';
        db.query(matchedEventsQuery, [userId], (err, matchedEventsResults) => {
            if (err) {
                console.error('Error fetching matched events:', err);
                return res.status(500).send('Server error.');
            }

            return res.status(200).json(matchedEventsResults);
        });
    });
});

// Endpoint to delete a notification
app.delete('/notifications/:id', (req, res) => {
    const { id } = req.params;
    console.log(`Attempting to delete notification with ID: ${id}`); // Log the notification ID
    const query = 'DELETE FROM notifications WHERE id = ?';
    db.query(query, [id], (err, results) => {
        if (err) {
            console.error('Error deleting notification:', err); // Log the error
            res.status(500).send('Server error.');
        } else {
            console.log(`Notification with ID: ${id} deleted successfully.`); // Log success
            res.status(200).send('Notification deleted successfully.');
        }
    });
});

// Start the server
app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});

module.exports = app;

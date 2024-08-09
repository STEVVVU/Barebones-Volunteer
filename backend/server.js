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

const db = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: 'password12345',
    database: 'VolunteerManagement'
});

db.connect(err => {
    if (err) {
        console.error('Error connecting to the database:', err);
        return;
    }
    console.log('Connected to the MySQL database.');
});

app.post('/register', (req, res) => {
    const { email, password } = req.body;
    const saltRounds = 10;

    bcrypt.hash(password, saltRounds, (err, hash) => {
        if (err) {
            return res.status(500).send('Server error.');
        }

        const query = 'INSERT INTO UserCredentials (email, password) VALUES (?, ?)';
        db.query(query, [email, hash], (err, result) => {
            if (err) {
                if (err.code === 'ER_DUP_ENTRY') {
                    return res.status(400).send('User already exists.');
                } else {
                    return res.status(500).send('Server error.');
                }
            }

            res.status(201).send('User registered successfully.');
        });
    });
});

app.post('/login', (req, res) => {
    const { email, password } = req.body;

    const query = 'SELECT password FROM UserCredentials WHERE email = ?';
    db.query(query, [email], (err, results) => {
        if (err) {
            return res.status(500).send('Server error.');
        }

        if (results.length === 0) {
            return res.status(401).send('Invalid email or password.');
        }

        const hashedPassword = results[0].password;
        bcrypt.compare(password, hashedPassword, (err, result) => {
            if (result) {
                return res.status(200).send('Login successful.');
            } else {
                return res.status(401).send('Invalid email or password.');
            }
        });
    });
});

app.get('/profile/:email', (req, res) => {
    const { email } = req.params;

    const query = 'SELECT * FROM UserProfile WHERE user_id = (SELECT id FROM UserCredentials WHERE email = ?)';
    db.query(query, [email], (err, results) => {
        if (err) {
            res.status(500).send('Server error.');
        } else if (results.length === 0) {
            res.status(404).send('User not found.');
        } else {
            res.status(200).json(results[0]);
        }
    });
});

app.put('/profile/:email', (req, res) => {
    const { email } = req.params;
    const profile = req.body;

    const checkQuery = 'SELECT * FROM UserProfile WHERE user_id = (SELECT id FROM UserCredentials WHERE email = ?)';
    db.query(checkQuery, [email], (err, results) => {
        if (results.length === 0) {
            const insertQuery = `
                INSERT INTO UserProfile (user_id, full_name, address, address2, city, state, zipcode, skills, preferences, availability_start, availability_end)
                VALUES ((SELECT id FROM UserCredentials WHERE email = ?), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `;
            db.query(insertQuery, [email, profile.full_name, profile.address, profile.address2, profile.city, profile.state, profile.zipcode, profile.skills, profile.preferences, profile.availability_start, profile.availability_end], (err, results) => {
                if (err) {
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
                    res.status(500).send('Server error.');
                } else {
                    res.status(200).send('Profile updated successfully.');
                }
            });
        }
    });
});

app.get('/logins', (req, res) => {
    const query = 'SELECT email FROM UserCredentials';
    db.query(query, (err, results) => {
        if (err) {
            res.status(500).send('Server error.');
        } else {
            res.status(200).json(results);
        }
    });
});

app.get('/users', (req, res) => {
    const query = 'SELECT email FROM UserCredentials';
    db.query(query, (err, results) => {
        if (err) {
            res.status(500).send('Server error.');
        } else {
            res.status(200).json(results);
        }
    });
});

app.post('/events', (req, res) => {
    const { name, description, location, requiredSkills, urgency, eventDates } = req.body;
    const [event_start_date, event_end_date] = eventDates[0].split(' to ');

    const query = `INSERT INTO EventDetails (event_name, description, location, required_skills, urgency, event_start_date, event_end_date)
                   VALUES (?, ?, ?, ?, ?, ?, ?)`;

    db.query(query, [name, description, location, requiredSkills.join(','), urgency, event_start_date, event_end_date], (err, results) => {
        if (err) {
            res.status(500).send('Server error.');
        } else {
            const notificationQuery = `INSERT INTO Notifications (email, message) VALUES (?, ?)`;
            const message = `A new event "${name}" has been created.`;
            db.query(notificationQuery, ['', message], (err, results) => {
                if (err) {
                    res.status(500).send('Server error.');
                } else {
                    res.status(200).send('Event created successfully.');
                }
            });
        }
    });
});

app.get('/events', (req, res) => {
    const query = 'SELECT * FROM EventDetails';
    db.query(query, (err, results) => {
        if (err) {
            res.status(500).send('Server error.');
        } else {
            res.status(200).json(results);
        }
    });
});

app.delete('/events/:id', (req, res) => {
    const { id } = req.params;
    const query = 'DELETE FROM EventDetails WHERE event_id = ?';
    db.query(query, [id], (err, results) => {
        if (err) {
            res.status(500).send('Server error.');
        } else {
            res.status(200).send('Event deleted successfully.');
        }
    });
});

app.post('/match-volunteer', (req, res) => {
    const { email, eventId } = req.body;
    const participationStatus = req.body.participationStatus || 'Assigned';

    // Fetch user ID based on the email provided
    const getUserQuery = 'SELECT id FROM UserCredentials WHERE email = ?';
    db.query(getUserQuery, [email], (err, userResults) => {
        if (err) {
            return res.status(500).send('Server error while fetching user ID.');
        }

        if (userResults.length === 0) {
            return res.status(404).send('User not found.');
        }

        const userId = userResults[0].id;

        // Check if the user is already matched to the specific event
        const checkMatchQuery = 'SELECT * FROM VolunteerHistory WHERE user_id = ? AND event_id = ?';
        db.query(checkMatchQuery, [userId, eventId], (err, matchResults) => {
            if (err) {
                return res.status(500).send('Server error while checking existing match.');
            }

            if (matchResults.length > 0) {
                return res.status(400).send('User is already matched to this event.');
            }

            // Fetch event details
            const eventQuery = 'SELECT * FROM EventDetails WHERE event_id = ?';
            db.query(eventQuery, [eventId], (err, eventResults) => {
                if (err) {
                    return res.status(500).send('Server error while fetching event details.');
                }

                if (eventResults.length === 0) {
                    return res.status(404).send('Event not found.');
                }

                const insertQuery = `
                    INSERT INTO VolunteerHistory 
                    (user_id, event_id, participation_status, date)
                    VALUES (?, ?, ?, ?)
                `;
                const participationDate = new Date(); // Use the current date as the participation date
                db.query(insertQuery, [userId, eventId, participationStatus, participationDate], (err, insertResults) => {
                    if (err) {
                        return res.status(500).send('Server error while inserting volunteer history.');
                    }

                    const notificationMessage = `You have been matched to the event "${eventResults[0].event_name}".`;
                    const notificationQuery = 'INSERT INTO Notifications (email, message) VALUES (?, ?)';
                    db.query(notificationQuery, [email, notificationMessage], (err, notificationResults) => {
                        if (err) {
                            return res.status(500).send('Server error while creating notification.');
                        }

                        const notificationId = notificationResults.insertId;
                        const userNotificationQuery = 'INSERT INTO UserNotifications (user_id, notification_id) VALUES (?, ?)';
                        db.query(userNotificationQuery, [userId, notificationId], (err, userNotificationResults) => {
                            if (err) {
                                return res.status(500).send('Server error while linking notification to user.');
                            }

                            return res.status(201).send('Volunteer matched and notified successfully.');
                        });
                    });
                });
            });
        });
    });
});

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
            res.status(500).send('Server error.');
        } else {
            res.status(200).json(results);
        }
    });
});

app.get('/notifications/:email', (req, res) => {
    const { email } = req.params;
    const queryGetUserId = 'SELECT id FROM UserCredentials WHERE email = ?';
    const queryGetUnreadNotifications = `
        SELECT n.* FROM Notifications n
        LEFT JOIN UserNotifications un ON n.id = un.notification_id AND un.user_id = ?
        WHERE un.is_read IS NULL OR un.is_read = FALSE;
    `;

    db.query(queryGetUserId, [email], (err, userResults) => {
        if (userResults.length === 0) {
            return res.status(404).send('User not found.');
        }

        const userId = userResults[0].id;
        db.query(queryGetUnreadNotifications, [userId], (err, results) => {
            if (err) {
                res.status(500).send('Server error.');
            } else {
                res.status(200).json(results);
            }
        });
    });
});

app.put('/notifications/:email/:id', (req, res) => {
    const { email, id } = req.params;
    const query = 'UPDATE UserNotifications SET is_read = 1 WHERE user_id = (SELECT id FROM UserCredentials WHERE email = ?) AND notification_id = ?';
    db.query(query, [email, id], (err, results) => {
        if (err) {
            res.status(500).send('Server error.');
        } else {
            res.status(200).send('Notification marked as read.');
        }
    });
});

app.get('/user-matched-events/:email', (req, res) => {
    const { email } = req.params;
    const getUserQuery = 'SELECT skills FROM UserProfile WHERE user_id = (SELECT id FROM UserCredentials WHERE email = ?)';

    db.query(getUserQuery, [email], (err, results) => {
        if (err) {
            console.error('Error fetching user profile:', err);
            return res.status(500).send('Server error.');
        }

        if (results.length === 0 || !results[0].skills) {
            console.warn('No skills found for this user.');
            return res.status(404).send('No matching events found for this user.');
        }

        console.log('User skills:', results[0].skills);
        const skills = results[0].skills ? results[0].skills.split(',') : [];

        // Fetch events that match the user's skills
        const getMatchingEventsQuery = `
            SELECT * FROM EventDetails 
            WHERE required_skills LIKE ?
        `;
        db.query(getMatchingEventsQuery, [`%${skills.join('%')}%`], (err, eventsResults) => {
            if (err) {
                console.error('Error fetching matching events:', err);
                return res.status(500).send('Server error.');
            }

            if (eventsResults.length === 0) {
                return res.status(404).send('No matching events found for this user.');
            }

            res.status(200).json(eventsResults);
        });
    });
});


app.delete('/notifications/:id', (req, res) => {
    const { id } = req.params;
    const query = 'DELETE FROM Notifications WHERE id = ?';
    db.query(query, [id], (err, results) => {
        if (err) {
            res.status(500).send('Server error.');
        } else {
            res.status(200).send('Notification deleted successfully.');
        }
    });
});

// Endpoint to fetch matching events for a volunteer
app.get('/matching-events/:email', (req, res) => {
    const email = req.params.email;

    // Fetch user skills from the UserProfile table
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

        console.log('User skills:', results[0].skills);
        const skills = results[0].skills.split(',');

        // Fetch events that match the user's skills
        const getMatchingEventsQuery = `
            SELECT * 
            FROM EventDetails 
            WHERE required_skills REGEXP ?
        `;

        const skillsRegex = skills.map(skill => `(${skill.trim()})`).join('|');
        console.log('Skills regex:', skillsRegex);

        db.query(getMatchingEventsQuery, [skillsRegex], (err, events) => {
            if (err) {
                console.error('Error fetching matching events:', err);
                return res.status(500).send('Server error.');
            }

            console.log('Matching events:', events);
            res.json(events);
        });
    });
});

app.use('/api', reportRoutes);

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});

module.exports = app;

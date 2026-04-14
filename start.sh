#!/bin/sh

# Generate host keys if they don't exist
ssh-keygen -A

# Start SSH daemon in the background
/usr/sbin/sshd

# Install or update dependencies in case package.json changed
npm install

# Seed preventive tables (plants, equipment, SPK, LK) with corrected data
# node src/preventive_seed.js


# Start the Node.js application in development mode (nodemon) so it auto-restarts on code changes
exec npm run dev

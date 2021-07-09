#!/usr/bin/env node

const { createServer } = require('../dist/server/server.js')

const PORT = 4000
const CWD = process.cwd()

createServer({ port: PORT, cwd: CWD })

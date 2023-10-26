const { initializeApp } = require('firebase-admin/app')
const { getFunctions } = require('firebase-admin/functions')

const app = initializeApp()
const functions = getFunctions(app)

module.exports = { functions }
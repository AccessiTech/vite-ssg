#!/usr/bin/env node

const { generate } = require('./index.js');

// Get command line arguments
const args = process.argv.slice(2);
const command = args[0];

if (command === 'generate') {
  generate()
    .then(() => {
      console.log('Static site generation completed!');
      process.exit(0);
    })
    .catch((error:any) => {
      console.error('Error generating static site:', error);
      process.exit(1);
    });
} else {
  console.log('Usage: vite-ssg generate');
  process.exit(1);
}
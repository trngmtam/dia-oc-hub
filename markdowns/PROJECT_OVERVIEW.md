# Project Overview

## Summary

**Nha Dat Pro** is a property management system for small landlords and managers in Vietnam. It centralizes property operations that are often scattered across spreadsheets, chat, and manual bookkeeping.

## Current product scope

The current repo includes:

- role-based authentication for owner, manager, and tenant users
- property and unit management
- manager assignment by invite code
- tenant connection to units by invite code
- lease creation and lease termination workflow
- invoice generation and payment proof review
- VietQR/manual bank transfer payment instructions
- expense logging and revenue analytics
- operational alerts and role-based notifications
- protected full demo database seed
- owner, manager, and tenant dashboards
- Google login as an optional add-on to manual auth

## Main goals

- Keep property, lease, and assignment data in one place
- Make ownership and management workflows easier to track
- Preserve operational history for finance and reporting
- Keep the codebase understandable for a student team

## Main user flows

- Owner: log in -> manage properties and units -> assign managers -> approve tenant requests -> manage leases -> review revenue and alerts
- Manager: log in -> request property assignment -> manage assigned properties -> approve tenant connection requests -> handle lease operations -> review assigned-property payments -> log expenses
- Tenant: log in -> connect to units using codes -> view contracts -> pay invoices -> review personal alerts

## Collaboration goal

This repo should remain easy to understand and safe to change. New contributors should be able to:

- clone the repo
- configure `.env`
- seed demo data
- run the app locally
- test a feature with demo accounts
- update the related markdown docs when behavior changes

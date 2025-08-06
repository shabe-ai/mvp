# Automatic Seeding for New Users

## Overview

When a new user signs up and creates their first team, the system automatically seeds sample data to help them get started with the CRM functionality.

## How It Works

1. **User Sign Up**: When a user signs up through Clerk authentication, they are automatically redirected to create their first team.

2. **Team Creation**: When a team is created via the `createTeam` mutation in `convex/crm.ts`, the system automatically triggers seeding.

3. **Automatic Seeding**: The seeding process runs asynchronously using Convex's scheduler to avoid blocking the team creation process.

## Seeded Data

The following sample data is automatically created for each new team:

### Accounts (3 sample companies)
- Acme Corporation (Technology)
- Global Solutions Inc (Consulting) 
- TechStart Ventures (Startup)

### Contacts (5 sample contacts)
- John Smith (CEO at Acme)
- Sarah Johnson (VP of Sales at Global Solutions)
- Mike Chen (CTO at TechStart)
- Emily Davis (Marketing Director at Acme)
- David Wilson (Operations Manager at Global Solutions)

### Activities (5 sample activities)
- Email: Initial Contact - Product Demo
- Call: Follow-up Call
- Meeting: Product Demo
- Email: Proposal Sent
- Call: Contract Discussion

### Deals (3 sample deals)
- Acme Enterprise License ($50,000)
- Global Solutions Consulting ($25,000)
- TechStart Partnership ($15,000)

## Implementation Details

### Files Modified
- `convex/crm.ts`: Modified `createTeam` mutation to automatically call seeding
- `convex/seed.ts`: Contains the `seedTeamData` function with sample data

### Error Handling
- If seeding fails, team creation still succeeds
- Errors are logged but don't prevent the user from using the system
- Seeding runs asynchronously to avoid blocking the UI

### Logging
The system includes detailed logging to track:
- Team creation events
- Seeding initiation
- Success/failure of seeding operations

## Testing

To test the seeding functionality:

1. Sign up as a new user
2. Create a new team
3. Check the Convex dashboard logs for seeding messages
4. Verify that sample data appears in the CRM interface

## Customization

To modify the seeded data, edit the `seedTeamData` function in `convex/seed.ts`. The function accepts a `teamId` parameter and creates sample data for that specific team. 
# **App Name**: Venturee Biz

## Core Features:

- Admin Portal for Company Creation: Owner portal to add new companies to the SaaS platform. Includes basic company information input.
- Automated Company Onboarding & Credential Generation: Upon company creation, automatically generate a unique email (companyname@ventureebiz.com) and a password with an AI-generated unique 8-character ID (companyname.venturee.uniqueid). These credentials are saved to the database and used for company login.
- Company Dashboard & Login: A secure login page for company owners using their auto-generated credentials, leading to their dedicated dashboard which includes a POS system.
- Integrated POS System: A basic point-of-sale system within the company dashboard for processing transactions.
- Viewer Role Management & Credential Generation: Company owners can add 'viewer' roles (name, username) within their dashboard. Automatically generates viewer-specific email (username_companyname@ventureebiz.com) and an AI-generated 8-character unique password. These credentials allow access to the viewer dashboard.
- Viewer Dashboard for Insights: A read-only dashboard accessible to viewer roles, displaying key company progress, profits, and sales data.
- Centralized Database for Company & User Data: A backend database to securely store company details, user accounts (admin, company, viewer), generated credentials, and POS data.

## Style Guidelines:

- Color scheme: Light theme, evoking nature and calm professionalism, using sage green and matcha tones.
- Primary color: Sage Green (#7E995E) to signify growth, stability, and a natural aesthetic for key interface elements and interactive components.
- Background color: Very light, desaturated green (#F6FEE8) for a clean, unobtrusive canvas that harmonizes with the primary color.
- Accent color: Muted Golden-Green (#CCCC7A), an earthy tone, used sparingly for calls to action, highlights, and secondary interactive elements to provide subtle contrast.
- Headline and Body font: 'Inter' (sans-serif) for its modern, clear, and neutral appearance, ensuring high readability across all data-heavy dashboards and transactional interfaces.
- Use a consistent set of clean, simple, and functional outline icons that are easily recognizable and support efficient navigation and data interpretation within the business application.
- A structured and organized layout focusing on clear hierarchy and easy access to information. Utilize card-based designs and responsive grids for optimal usability on various devices, especially for dashboard and POS interfaces.
- Implement subtle and purposeful micro-interactions and transitions, such as smooth fades for data updates, gentle slides for navigation changes, and concise loading animations, to provide immediate feedback and enhance the overall user experience without distraction.
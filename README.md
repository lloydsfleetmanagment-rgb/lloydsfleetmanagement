# Fleet IQ Pro

Create a modern, professional web-based Fleet Management System (FMS) called LLOYDS FLEETIQ  for Surjagarh Iron Ore Mine  take sample logo of lloyds metals and thriveni earthmovers logo and make an animation before login process after logion no need to animate but the lloyds logo should be on the left corner 
Critical Constraint 
The entire system must work without installing any new hardware. No new GPS devices, sensors, cameras, trackers, or equipment is required. All data comes from existing production reports, shift logs, weighbridge tickets, manual/tablet entries by operators using devices they already have, and any existing OEM systems.
Overall Style
- Clean 3D theme with subtle depth, soft shadows, and gentle perspective
- Minimal colour palette: deep charcoal (#121417), soft graphite (#1E2228), muted steel blue (#3A4A5C), pure white text, and a single accent colour in soft emerald green (#2DD4A8) for success/active states
- Extremely minimal and elegant — no bright colours, no clutter
- Smooth, subtle micro-animations (gentle fade-ins, soft hover lifts, smooth number counters, light 3D card tilts on hover)
- Dark mode only, premium industrial-tech aesthetic
- Fully responsive
Login Access + Role-Based Access Control
- Beautiful, minimal login page with the name LLOYDSFLEETIQ
- Clean centered card with soft 3D elevation
- Fields: Email / Username and Password
- Soft emerald “Login” button with subtle hover animation
- “Forgot Password” link and “Remember me” AND SHOW PASSWOED 
- After successful login, smooth transition into the main dashboard
Three Roles with clear permissions:
1. Admin – Full access (Add, Edit, Delete everything + manage users)
2. Supervisor – Can Add and Edit equipment, dig faces, production, crushers (cannot delete critical data or manage users)
3. Operator – View only + can edit status/location/remarks of their assigned equipment only
- Sidebar and buttons dynamically show/hide based on role
- Current role clearly shown in the top header
Dumpers:
- 101, 102, 103, 104, 105, 106, 107, 108, 109, 110, 111, 112, 113, 114
- 301, 302, 303, 304, 305, 306, 307, 308, 309, 310, 311, 312, 313, 314, 315, 316, 317, 318, 319, 320, 321, 322, 323, 324, 325, 326, 327, 328, 329, 330
Sany Trucks:
- 1, 2, 3, 4, 5, 6, 7, 9, 10, 11, 12, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 44, 45, 46, 47, 48, 49, 50, 51, 52, 53, 54, 55, 56, 57, 58
(Exclude Sany 8 and Sany 13)
All these equipment must appear as individual cards in the Fleet section by default.
Layout & Structure (after login)
- Left sidebar (collapsible): Dashboard, Fleet, Production, Dig Faces, Crushers & Pipeline, Reports, Settings
- Top header: LLOYDS FLEETIQ  logo/name, live date/time, current role, user profile + logout
- Floating 3D cards with soft elevation
Key Screens & Features
1. Main Dashboard
- Large 3D KPI cards (Today’s Production, Hematite vs BHQ, Active Trucks, Shovel Utilization, Pipeline Throughput)
- Stylized 3D mine map of the 348 Ha lease
- Production progress bars
2. Fleet Management
- Grid of all pre-loaded Dumpers (101–114 & 301–330) and Sany trucks (1–58 except 8 & 13)
- Each card shows: Equipment ID, Type (Dumper / Sany), Status, Current location, Cycle count, Operator
- “+ Add Equipment” button (Admin & Supervisor only)
- Click any card → editable side panel (role-based)
3. Production & Dig Faces
- “+ Add Dig Face” and “+ Add Production Entry” (Admin & Supervisor)
- Full edit capability according to role
4. Crushers 
ADD TH-1, TH2, TH3, TH4 , TH5 IN CRUSHER ONCE THE OPERATOR ENTERED THE DATA AND DESTINATION THAT ROM SHOULD BE ADDED IN CRUSHERS FLEET ,AND SUMMARY ALSO 
- 3D status cards + Add/Edit controlled by role
5. Universal Add + Edit System
- Role-controlled Add / Edit / Delete
- Soft success animations and clear confirmation messages
- Auto-save + manual save
Extra Details
- Soft ambient lighting and very light background particle effects
- Clean typography
- Elegant loading and empty states
- Smooth 300–400 ms animations
- Pure software solution – zero new hardware required
Make the entire experience feel premium, calm, reliable, and purpose-built for mining engineers with accurate pre-loaded Dumper and Sany fleet data and strict role-based access control. MODIFY EXISTING LLOYDS FLEET IQ ONLY
Do not rebuild the application. Keep all existing working UI, database architecture, pages, calculations, reports, and single-source-of-truth logic.
Modify only the following sections.
1. OPERATOR IDENTIFICATION
Keep Login ID/User ID and Employee ID separate.
Login/User ID = authentication and system access.
Employee ID = operational identification of the operator/employee.
Each operational record must store and display Employee ID and Employee Name.
Use Employee ID for easy identification in Operator Log, Fleet Management, reports, filters, audit records, and Excel exports.
Do not merge Login ID with Employee ID.
For logged-in operators, automatically retrieve the linked Employee ID and Employee Name.
2. ADD MATERIAL → DESTINATION DEPENDENT DROPDOWN
Modify the Operator Log form.
When Material is selected, show only the valid destination options:
ROM:
TH-1
TH-2
TH-3
TH-4
TH-5
BHQ:
BHQ Dump
SHALE:
Shale Dump Top
Shale Dump Bottom
The destination list must automatically change when the Material changes.
Clear any previously selected invalid destination.
Do not show unrelated destinations.
3. ADD TH-2 AND TH-3 EQUIPMENT VALIDATION
TH-2 and TH-3 are SANY ONLY locations.
Rule:
If Destination = TH-2 or TH-3
AND Equipment Type = Dumper/DMP
Then block the operation.
Show an immediate popup:
INVALID EQUIPMENT
TH-2 and TH-3 allow SANY equipment only. Please select SANY equipment or change the destination.
The invalid record must not be saved.
Validate this on both:
Frontend
Server/database/API
Do not allow users to bypass this rule.
Valid example:
ROM → TH-2 → SANY → ALLOWED
Invalid example:
ROM → TH-2 → DMP/Dumper → BLOCKED
Apply the same rule to TH-3.
4. UPDATE OPERATOR LOG FLOW
The form flow should be:
Login → Employee ID Auto-Identification → Equipment → Material → Valid Destination → Actual Trips → Automatic Quantity → Validation → Save
When the Material changes, update Destination options.
When TH-2 or TH-3 is selected, validate the equipment immediately.
If an invalid combination exists, show the popup and prevent Save until corrected.
 when he enters the trips of dumper the no of trips should be multiplied by 100 and in sany if he entered no of trips should be multiplied by 70 and unloading time and loading time should be added in the operator log and NOTE :  the operator  dashboard should be designed seperately and the enetred trips should be added in fleet according to the dumper number selected by the operator  , production and and summary 
5. ADD EMERGENCY BUTTON
Add an EMERGENCY button at the top-right corner of the Operator Dashboard.
When clicked:
Show a confirmation popup.
Ask the operator to confirm sending the emergency alert.
On confirmation, create and save an Emergency Alert.
Send the alert immediately to the Admin Dashboard without page reload.
Alert data should include:
Alert ID
Timestamp
Employee ID
Employee Name
Login/User ID
Shift
Equipment, if available
Material, if available
Destination, if available
Status
Status:
NEW
ACKNOWLEDGED
RESOLVED
6. ADD REAL-TIME ADMIN EMERGENCY POPUP
When an operator confirms an Emergency Alert:
Save it in PostgreSQL/Supabase.
Send it to the Admin Dashboard immediately using real-time subscriptions or live updates.
Do not require the Admin to refresh the page.
Show a popup:
🚨 EMERGENCY ALERT
Display:
Employee ID
Employee Name
Time
Shift
Equipment
Material
Destination
Admin actions:
ACKNOWLEDGE
VIEW DETAILS
RESOLVE
Store all status changes and actions for audit/history.
7. DATABASE / MASTER DATA ADDITIONS
Add or update the necessary database relationships for:
Employee ID
Employee Name
Login/User ID
Material
Destination
Equipment Type Restrictions
Emergency Alerts
Prefer configurable master data instead of hard-coding rules throughout the frontend.
The system should support rules similar to:
Material → Allowed Destinations
and:
Destination → Allowed Equipment Types
Initial configuration:
ROM → TH-1, TH-2, TH-3, TH-4, TH-5
BHQ → BHQ Dump
SHALE → Shale Dump Top, Shale Dump Bottom
TH-2 → SANY ONLY
TH-3 → SANY ONLY
8. AUDIT AND VALIDATION
Record important actions including:
Invalid equipment/destination attempts
Emergency Alert creation alert should be sent to sweja06@gmail account for trial purpose and alaram also to the same account and regarding emergency all the things should be sent to the given reference mail id 
Emergency acknowledgement
Emergency resolution
Operational record creation and updates
The existing single-source-of-truth rule must remain unchanged.
Do not create duplicate data-entry forms, duplicate databases, static dashboards, or separate production records.
FINAL ACCEPTANCE TEST
The modification is complete only when:
Operator logs in using Login ID.
Correct Employee ID is automatically identified.
ROM shows only TH-1 to TH-5.
BHQ shows only BHQ Dump.
SHALE shows only Shale Dump Top and Shale Dump Bottom.
DMP/Dumper + TH-2 is blocked with a popup.
DMP/Dumper + TH-3 is blocked with a popup.
SANY is allowed at TH-2 and TH-3.
Invalid records cannot be saved through either frontend or API/server.
Emergency button is visible at the top-right of the Operator Dashboard.
Emergency Alert is immediately received as a popup on the Admin Dashboard.
Alert is stored, acknowledged, and resolved with history.
Automatic calculations , dashboard, reports, summaries, and Excel exports continue using the same PostgreSQL/Supabase source of truth.
Do not change unrelated working features. Modify only the required sections above.  
On the main dashboard add hourly report option of rom for shift wise and hourly

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://lloydsfleetmanagement.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/b84c1a24-1ff8-499b-8c81-56ebbb3e3613).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```

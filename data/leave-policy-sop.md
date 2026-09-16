# Sri Cempaka International Academy — Standard Operating Procedure (SOP): Staff Leave Applications & Workflow Routing

**Document Reference**: SCIA-SOP-OPS-004  
**Custodian**: School Operations & Human Resources Department  
**Applicability**: All Academic, Administrative, and Support Staff  

---

## 1. Purpose & Scope
This Standard Operating Procedure outlines the end-to-end process for applying, reviewing, approving, and auditing staff leave requests. It establishes strict accountability to prevent unmonitored classroom disruptions and maintain adequate adult-to-student pastoral supervision ratios.

---

## 2. Leave Classification Matrix

| Leave Category | Maximum Days / Entitlement | Advance Notice Required | Documentary Proof | First-Level Approver | Final Approver |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Annual Leave** | 16–22 days (administrative staff only) | 14 calendar days | Leave Request Form | Immediate Supervisor | School Administrator |
| **Emergency Leave** | 3 days per annum | Before 06:45 on date of absence | Formal declaration + Relief pack | Head of Department (HoD) | School Administrator |
| **Medical / Sick Leave** | 14 days per annum | Within 24 hours of return | Official Clinic/Hospital MC | Head of Department (HoD) | School Administrator |
| **Hospitalisation Leave** | Up to 60 days | Immediate notice upon admission | Hospital Admission Slip | Head of Department (HoD) | School Administrator & Principal |
| **Compassionate Leave** | 3 consecutive days | Within 24 hours | Death certificate / obituary | Head of Department (HoD) | School Administrator |
| **Maternity Leave** | 98 consecutive days | 60 days in advance | Doctor's EDD confirmation | Head of Department (HoD) | School Administrator |
| **Paternity Leave** | 7 consecutive days | 14 days in advance | Child birth certificate | Head of Department (HoD) | School Administrator |
| **Unpaid Leave (Cuti Tanpa Gaji)** | Case-by-case basis | 30 calendar days | Formal written appeal | HoD & School Administrator | Principal & Board |

---

## 3. Detailed Procedure for Emergency Leave (Cuti Kecemasan)

### Step 1: Immediate Notification
- When an unexpected personal crisis, sudden acute illness of a dependent, or severe transit incident occurs, the staff member must notify the designated department emergency channel before **06:45 AM**.
- The staff member states:
  1. Nature of emergency (brief reason).
  2. Estimated duration (single day or multi-day).
  3. Contact phone number for urgent queries.

### Step 2: Classroom Relief Assignment & Duty Handover
- Staff must upload or email emergency lesson tasks for all scheduled classes by **07:00 AM**.
- If a nominated covering teacher was mutually agreed upon, that colleague's name must be specified.
- If no relief teacher has been nominated, the Head of Department assigns a relief teacher from the scheduled off-period roster.

### Step 3: Formal System Submission
- Within **24 hours**, the employee must submit a digital leave application on the SchoolPilot portal.
- Required attributes:
  - `leave_type`: `"emergency"`
  - `start_date`: `YYYY-MM-DD`
  - `end_date`: `YYYY-MM-DD`
  - `reason`: Specific explanation of emergency circumstance
  - `covering_teacher`: Full name or email of colleague handling relief

### Step 4: Approval & Audit Chain
1. **Head of Department Review**:
   - Verification of relief teacher coverage.
   - Validation that departmental class minimum requirements are satisfied.
   - Approves or Rejects with commentary within four (4) operational hours.
2. **School Administrator Final Verification**:
   - Checks remaining emergency leave balance (maximum 3 days per year).
   - Confirms no examination or inspection conflicts.
   - Final system status updated to `approved` or `rejected`.
3. **Audit Trail Generation**:
   - System registers timestamped event containing submitter ID, reviewer ID, status change, and IP address.

---

## 4. Non-Compliance & Unauthorised Absences
- Failure to report before 06:45 AM on the day of emergency leave without justifiable mitigating circumstances results in automatic conversion to Unauthorised Absence.
- Unauthorised absence results in salary deduction equivalent to the daily wage rate (Monthly Basic Salary / 26) and a formal note placed in the staff personnel file.

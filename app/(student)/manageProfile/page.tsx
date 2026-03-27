"use client";

export default function ManageProfile() {
  return (
    <div className="h-full w-full bg-[full] px-6 py-8">
      <div className="mx-auto max-w-7xl">
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_320px]">
          {/* Main Content */}
          <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
            <div className="px-8 py-8">
              {/* Contact Information */}
              <section className="border-b border-gray-200 pb-8">
                <h2 className="mb-8 text-3xl font-semibold text-gray-800">
                  Contact Information
                </h2>

                <div className="grid grid-cols-1 gap-x-10 gap-y-5 md:grid-cols-2">
                  <InfoField label="Email" value="BillyBob421@gmail.com" />
                  <InfoField label="Additional email" value="" />
                  <InfoField label="Mobile phone" value="" />
                  <InfoField label="Home phone" value="" />
                  <InfoField label="Address" value="" />
                  <InfoField label="Address line 2" value="" />
                  <InfoField label="City" value="" />
                  <InfoField label="State" value="" />
                  <InfoField label="Zip/postal code" value="" />
                  <InfoField label="Country" value="" />
                  <InfoField label="Additional info" value="" />
                </div>

                <button className="mt-6 rounded-lg border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-medium text-blue-700 transition hover:bg-blue-100">
                  Add Contact
                </button>
              </section>

              {/* Notifications */}
              <section className="border-b border-gray-200 py-8">
                <h2 className="mb-8 text-3xl font-semibold text-gray-800">
                  Notifications
                </h2>

                <div className="grid grid-cols-1 gap-x-10 gap-y-5 md:grid-cols-2">
                  <InfoField label="Lesson reminders" value="Off" />
                  <InfoField label="Lesson notes" value="Off" />
                </div>
              </section>

              {/* User Account */}
              <section className="border-b border-gray-200 py-8">
                <h2 className="mb-8 text-3xl font-semibold text-gray-800">
                  User Account
                </h2>

                <div className="grid grid-cols-1 gap-x-10 gap-y-5 md:grid-cols-2">
                  <InfoField label="User account" value="Disabled" />
                </div>
              </section>

              {/* Students */}
              <section className="border-b border-gray-200 py-8">
                <h2 className="mb-6 text-3xl font-semibold text-gray-800">
                  Students
                </h2>

                <TableHeader
                  columns={["Name", "Email", "Mobile Phone", "Status"]}
                  widths="grid-cols-4"
                />

                <div className="mt-4 rounded-lg border border-gray-200 bg-white px-4 py-4 text-gray-700">
                  This family has no students.{" "}
                  <span className="cursor-pointer font-medium text-blue-600 hover:text-blue-700">
                    Add a Student
                  </span>
                </div>
              </section>

              {/* Package Balances */}
              <section className="border-b border-gray-200 py-8">
                <h2 className="mb-6 text-3xl font-semibold text-gray-800">
                  Package Balances
                </h2>

                <TableHeader
                  columns={[
                    "Service Type",
                    "Purchased",
                    "Scheduled",
                    "Unscheduled",
                    "Used",
                    "Unused",
                  ]}
                  widths="grid-cols-6"
                />

                <div className="mt-4 rounded-lg border border-gray-200 bg-white px-4 py-6 text-center text-gray-500">
                  No records found.
                </div>
              </section>

              {/* Recent Invoices */}
              <section className="border-b border-gray-200 py-8">
                <div className="mb-6 flex items-center gap-4">
                  <h2 className="text-3xl font-semibold text-gray-800">
                    Recent Invoices
                  </h2>
                  <button className="text-base font-medium text-blue-600 hover:text-blue-700">
                    Create Invoice
                  </button>
                </div>

                <TableHeader
                  columns={[
                    "Date",
                    "Invoice Number",
                    "Status",
                    "Due Date",
                    "Invoice Total",
                  ]}
                  widths="grid-cols-5"
                />

                <div className="mt-4 rounded-lg border border-gray-200 bg-white px-4 py-4 text-gray-700">
                  No recent invoices.{" "}
                  <span className="cursor-pointer font-medium text-blue-600 hover:text-blue-700">
                    Create an Invoice
                  </span>
                </div>
              </section>

              {/* Recent Payments */}
              <section className="pt-8">
                <h2 className="mb-6 text-3xl font-semibold text-gray-800">
                  Recent Payments
                </h2>

                <TableHeader
                  columns={["Date", "Type", "Description", "Amount"]}
                  widths="grid-cols-4"
                />

                <div className="mt-4 rounded-lg border border-gray-200 bg-white px-4 py-4 text-gray-700">
                  No recent payments.{" "}
                  <span className="cursor-pointer font-medium text-blue-600 hover:text-blue-700">
                    Record a Payment
                  </span>
                </div>
              </section>
            </div>
          </div>

          {/* Right Sidebar */}
          <div className="h-fit rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <button className="mb-6 text-left text-lg font-medium text-blue-600 hover:text-blue-700">
              ← Families Table
            </button>

            <div className="space-y-6">
              <div>
                <p className="mb-2 text-sm font-semibold uppercase tracking-wide text-gray-500">
                  Created At
                </p>
                <div className="rounded-lg border border-gray-200 bg-white px-4 py-3 text-gray-700">
                  2026-03-03 03:20
                </div>
              </div>

              <div>
                <p className="mb-2 text-sm font-semibold uppercase tracking-wide text-gray-500">
                  Last Updated
                </p>
                <div className="rounded-lg border border-gray-200 bg-white px-4 py-3 text-gray-700">
                  2026-03-03 03:20
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function InfoField({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="grid grid-cols-1 gap-2 lg:grid-cols-[220px_1fr] lg:items-center">
      <label className="text-lg font-medium text-gray-700">{label}</label>
      <div className="min-h-[48px] rounded-lg border border-gray-200 bg-white px-4 py-3 text-base text-gray-800 shadow-sm">
        {value || <span className="text-gray-400">—</span>}
      </div>
    </div>
  );
}

function TableHeader({
  columns,
  widths,
}: {
  columns: string[];
  widths: string;
}) {
  return (
    <div
      className={`grid ${widths} rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-base font-semibold text-gray-700`}
    >
      {columns.map((column) => (
        <div key={column}>{column}</div>
      ))}
    </div>
  );
}
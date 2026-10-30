-- CreateTable
CREATE TABLE "DepartmentCharge" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "departmentId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DepartmentCharge_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DepartmentCharge_departmentId_idx" ON "DepartmentCharge"("departmentId");

-- CreateIndex
CREATE UNIQUE INDEX "DepartmentCharge_employeeId_departmentId_key" ON "DepartmentCharge"("employeeId", "departmentId");

-- AddForeignKey
ALTER TABLE "DepartmentCharge" ADD CONSTRAINT "DepartmentCharge_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DepartmentCharge" ADD CONSTRAINT "DepartmentCharge_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE CASCADE ON UPDATE CASCADE;

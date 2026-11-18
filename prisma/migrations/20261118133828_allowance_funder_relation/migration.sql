-- AddForeignKey
ALTER TABLE "Allowance" ADD CONSTRAINT "Allowance_funderId_fkey" FOREIGN KEY ("funderId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

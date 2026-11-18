-- CreateEnum
CREATE TYPE "AccountType" AS ENUM ('PERSONAL', 'BUSINESS');

-- CreateEnum
CREATE TYPE "KycTier" AS ENUM ('NONE', 'BASIC', 'FULL_PENDING', 'FULL');

-- CreateEnum
CREATE TYPE "ExchangeLink" AS ENUM ('NONE', 'PENDING', 'LINKED');

-- CreateEnum
CREATE TYPE "RequestStatus" AS ENUM ('OPEN', 'PAID', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PaymentKind" AS ENUM ('SEND', 'REQUEST_PAYMENT', 'ALLOWANCE_DRAW', 'TOP_UP', 'CASH_OUT');

-- CreateEnum
CREATE TYPE "AllowanceStatus" AS ENUM ('ACTIVE', 'CANCELLED');

-- CreateEnum
CREATE TYPE "CashOutDestination" AS ENUM ('RYT_BANK', 'TNG_EWALLET', 'OTHER_DUITNOW', 'JOMPAY_BILL');

-- CreateEnum
CREATE TYPE "DraftKind" AS ENUM ('SEND', 'PAY_REQUEST', 'CREATE_REQUEST', 'CASH_OUT');

-- CreateEnum
CREATE TYPE "DraftStatus" AS ENUM ('PENDING', 'CONFIRMED', 'EXPIRED', 'CANCELLED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "handle" TEXT NOT NULL,
    "accountType" "AccountType" NOT NULL DEFAULT 'PERSONAL',
    "businessName" TEXT,
    "suiAddress" TEXT,
    "kycTier" "KycTier" NOT NULL DEFAULT 'NONE',
    "kycCountry" TEXT,
    "kycIdType" TEXT,
    "kycIdLast4" TEXT,
    "exchangeLink" "ExchangeLink" NOT NULL DEFAULT 'NONE',
    "giftAt" TIMESTAMP(3),
    "zekeEnabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Contact" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "handle" TEXT,
    "address" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Contact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentRequest" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "payeeId" TEXT NOT NULL,
    "amountMinor" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "payerName" TEXT,
    "lineItems" JSONB,
    "status" "RequestStatus" NOT NULL DEFAULT 'OPEN',
    "paidTxDigest" TEXT,
    "paidBy" TEXT,
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL,
    "kind" "PaymentKind" NOT NULL,
    "fromAddress" TEXT NOT NULL,
    "toAddress" TEXT NOT NULL,
    "amountMinor" TEXT NOT NULL,
    "txDigest" TEXT NOT NULL,
    "note" TEXT,
    "requestId" TEXT,
    "allowanceId" TEXT,
    "draftId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Receipt" (
    "id" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "body" JSONB NOT NULL,
    "sha256" TEXT NOT NULL,
    "walrusBlobId" TEXT,
    "walrusUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Receipt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Allowance" (
    "id" TEXT NOT NULL,
    "funderId" TEXT NOT NULL,
    "spenderAddress" TEXT NOT NULL,
    "spenderLabel" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "monthlyLimitMinor" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "allowanceObjectId" TEXT NOT NULL,
    "capObjectId" TEXT NOT NULL,
    "createTx" TEXT NOT NULL,
    "status" "AllowanceStatus" NOT NULL DEFAULT 'ACTIVE',
    "cancelTx" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Allowance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CashOut" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "destination" "CashOutDestination" NOT NULL,
    "bankName" TEXT,
    "billerCode" TEXT,
    "accountHolder" TEXT NOT NULL,
    "accountLast4" TEXT NOT NULL,
    "amountMinor" TEXT NOT NULL,
    "feeMinor" TEXT NOT NULL,
    "rate" TEXT NOT NULL,
    "myrSen" TEXT NOT NULL,
    "txDigest" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CashOut_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ZekeDraft" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" "DraftKind" NOT NULL,
    "payload" JSONB NOT NULL,
    "sources" JSONB NOT NULL,
    "draftHash" TEXT NOT NULL,
    "needsStepUp" BOOLEAN NOT NULL,
    "warnings" JSONB NOT NULL,
    "status" "DraftStatus" NOT NULL DEFAULT 'PENDING',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ZekeDraft_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_handle_key" ON "User"("handle");

-- CreateIndex
CREATE UNIQUE INDEX "User_suiAddress_key" ON "User"("suiAddress");

-- CreateIndex
CREATE UNIQUE INDEX "Contact_ownerId_label_key" ON "Contact"("ownerId", "label");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentRequest_slug_key" ON "PaymentRequest"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentRequest_paidTxDigest_key" ON "PaymentRequest"("paidTxDigest");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_txDigest_key" ON "Payment"("txDigest");

-- CreateIndex
CREATE UNIQUE INDEX "Receipt_paymentId_key" ON "Receipt"("paymentId");

-- CreateIndex
CREATE UNIQUE INDEX "Allowance_allowanceObjectId_key" ON "Allowance"("allowanceObjectId");

-- CreateIndex
CREATE UNIQUE INDEX "CashOut_txDigest_key" ON "CashOut"("txDigest");

-- AddForeignKey
ALTER TABLE "Receipt" ADD CONSTRAINT "Receipt_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

const { getDb, isFirebaseReady } = require("../config/firebase");

/**
 * Sync a transaction to Firestore for real-time client updates.
 * Path: users/{userId}/transactions/{transactionId}
 *
 * Failures are logged but NEVER block the MongoDB write.
 */
const syncTransactionToFirestore = async (transaction) => {
  if (!isFirebaseReady()) return;

  try {
    const db = getDb();
    const docRef = db
      .collection("users")
      .doc(String(transaction.userId))
      .collection("transactions")
      .doc(String(transaction._id));

    await docRef.set({
      amount: transaction.amount,
      type: transaction.type,
      category: transaction.category || "other",
      description: transaction.description || "",
      date: transaction.date ? transaction.date.toISOString() : new Date().toISOString(),
      uploadMonth: transaction.uploadMonth || "",
      source: transaction.source || "manual",
      createdAt: transaction.createdAt
        ? transaction.createdAt.toISOString()
        : new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    console.log(`[Firestore] Synced transaction ${transaction._id}`);
  } catch (err) {
    console.error("[Firestore] Sync failed:", err.message);
  }
};

/**
 * Update an existing transaction in Firestore.
 */
const updateTransactionInFirestore = async (transaction) => {
  if (!isFirebaseReady()) return;

  try {
    const db = getDb();
    const docRef = db
      .collection("users")
      .doc(String(transaction.userId))
      .collection("transactions")
      .doc(String(transaction._id));

    await docRef.update({
      amount: transaction.amount,
      type: transaction.type,
      category: transaction.category || "other",
      description: transaction.description || "",
      date: transaction.date ? transaction.date.toISOString() : new Date().toISOString(),
      uploadMonth: transaction.uploadMonth || "",
      updatedAt: new Date().toISOString(),
    });

    console.log(`[Firestore] Updated transaction ${transaction._id}`);
  } catch (err) {
    // If document doesn't exist, create it instead
    if (err.code === 5) {
      await syncTransactionToFirestore(transaction);
    } else {
      console.error("[Firestore] Update failed:", err.message);
    }
  }
};

/**
 * Delete a transaction from Firestore.
 */
const deleteTransactionFromFirestore = async (userId, transactionId) => {
  if (!isFirebaseReady()) return;

  try {
    const db = getDb();
    await db
      .collection("users")
      .doc(String(userId))
      .collection("transactions")
      .doc(String(transactionId))
      .delete();

    console.log(`[Firestore] Deleted transaction ${transactionId}`);
  } catch (err) {
    console.error("[Firestore] Delete failed:", err.message);
  }
};

module.exports = {
  syncTransactionToFirestore,
  updateTransactionInFirestore,
  deleteTransactionFromFirestore,
};

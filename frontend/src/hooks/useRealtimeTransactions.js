import { useState, useEffect } from "react";
import { collection, query, onSnapshot, orderBy, limit } from "firebase/firestore";
import { db } from "../firebase";

/**
 * Hook to listen to user transactions in real-time from Firestore.
 * Requires the user's stringified ObjectId as userId.
 */
const useRealtimeTransactions = (userId, limitCount = 50) => {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!userId) {
      setTransactions([]);
      setLoading(false);
      return;
    }

    const transactionsRef = collection(db, "users", String(userId), "transactions");
    const q = query(
      transactionsRef,
      orderBy("date", "desc"),
      limit(limitCount)
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const fetchedTransactions = snapshot.docs.map((doc) => ({
          _id: doc.id,
          ...doc.data(),
        }));
        setTransactions(fetchedTransactions);
        setLoading(false);
        setError(null);
      },
      (err) => {
        console.error("Firestore real-time sync error:", err);
        setError(err.message);
        setLoading(false);
      }
    );

    // Cleanup listener on unmount
    return () => unsubscribe();
  }, [userId, limitCount]);

  return { transactions, loading, error };
};

export default useRealtimeTransactions;

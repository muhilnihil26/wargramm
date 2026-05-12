import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { User, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut as firebaseSignOut, onAuthStateChanged, signInWithPopup, signInWithRedirect, getRedirectResult, sendPasswordResetEmail, sendEmailVerification, signInWithCredential, GoogleAuthProvider, updateProfile } from "firebase/auth";
import { Capacitor } from "@capacitor/core";
import { FirebaseAuthentication } from "@capacitor-firebase/authentication";
import { auth, googleProvider } from "@/integrations/firebase/config";
import { getKnownProfile } from "@/lib/knownUsers";

interface AuthContextType {
  user: (User & { id: string }) | null;
  session: any;
  loading: boolean;
  signOut: () => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signUpWithEmail: (email: string, password: string) => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  loading: true,
  signOut: async () => {},
  signInWithGoogle: async () => {},
  signInWithEmail: async () => {},
  signUpWithEmail: async () => {},
  resetPassword: async () => {},
});

export const useAuth = () => useContext(AuthContext);

const withId = (user: User | null): (User & { id: string }) | null => {
  if (!user) return null;
  return Object.assign(user, { id: user.uid });
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<(User & { id: string }) | null>(null);
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getRedirectResult(auth)
      .then((result) => {
        if (result?.user) setUser(withId(result.user));
      })
      .catch(() => {});
    if (Capacitor.isNativePlatform()) {
      FirebaseAuthentication.getPendingAuthResult().catch(() => {});
    }
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      const knownProfile = getKnownProfile(user?.email);
      if (user && knownProfile && user.displayName !== knownProfile.fullName) {
        updateProfile(user, { displayName: knownProfile.fullName }).catch(() => {});
      }
      setUser(withId(user));
      setSession(user ? { user } : null);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const signInWithGoogle = async () => {
    try {
      if (Capacitor.isNativePlatform()) {
        const result = await FirebaseAuthentication.signInWithGoogle({ skipNativeAuth: true });
        const credential = result.credential;
        if (!credential?.idToken && !credential?.accessToken) {
          throw new Error("Google did not return a sign-in token.");
        }
        await signInWithCredential(auth, GoogleAuthProvider.credential(credential.idToken, credential.accessToken));
        return;
      }
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      if (Capacitor.isNativePlatform()) {
        throw error;
      }
      try {
        await signInWithRedirect(auth, googleProvider);
      } catch {
        throw error;
      }
    }
  };

  const signInWithEmail = async (email: string, password: string) => {
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (error) {
      throw error;
    }
  };

  const signUpWithEmail = async (email: string, password: string) => {
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      if (userCredential.user) {
        await sendEmailVerification(userCredential.user);
      }
    } catch (error) {
      throw error;
    }
  };

  const resetPassword = async (email: string) => {
    try {
      if (Capacitor.isNativePlatform()) {
        await FirebaseAuthentication.sendPasswordResetEmail({ email });
        return;
      }
      await sendPasswordResetEmail(auth, email);
    } catch (error) {
      throw error;
    }
  };

  const signOut = async () => {
    await firebaseSignOut(auth);
  };

  return (
    <AuthContext.Provider value={{
      user,
      session,
      loading,
      signOut,
      signInWithGoogle,
      signInWithEmail,
      signUpWithEmail,
      resetPassword
    }}>
      {children}
    </AuthContext.Provider>
  );
}

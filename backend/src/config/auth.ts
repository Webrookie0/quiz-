import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import User, { type IUser } from '../models/User.js';

export const initializePassport = () => {
  passport.use(
    new GoogleStrategy(
      {
        clientID: process.env.GOOGLE_CLIENT_ID || '',
        clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
        callbackURL: process.env.GOOGLE_CALLBACK_URL || '/api/auth/google/callback',
      },
      async (_accessToken, _refreshToken, profile, done) => {
        try {
          let user = await User.findOne({ googleId: profile.id });

          if (user) {
            return done(null, user);
          }

          const newuserdata: Partial<IUser> = {
            googleId: profile.id,
            email: profile.emails?.[0]?.value || '',
            name: profile.displayName || '',
          };
          if (profile.photos?.[0]?.value) {
            newuserdata.picture = profile.photos?.[0]?.value;
          }
          const newuser = await User.create(newuserdata)

          return done(null, newuser);
        } catch (error) {
          return done(error);
        }
      }
    )
  );

  passport.serializeUser((user: any, done) => {
    done(null, user._id);
  });

  passport.deserializeUser(async (id: string, done) => {
    try {
      const user = await User.findById(id);
      done(null, user);
    } catch (error) {
      done(error, null);
    }
  });
};



import { FC } from 'react';
import { Link } from 'react-router-dom';
import { Logo } from '@/components/common/Logo';

const year = new Date().getFullYear();

export const Footer: FC = () => (
  <footer className="site-footer">
    <div className="container site-footer-inner">
      <div className="site-footer-brand">
        <Logo size={36} />
        <p className="muted text-sm">
          The friendliest place to buy and sell almost anything — locally and securely.
        </p>
      </div>

      <div className="site-footer-cols">
        <div>
          <h5>Marketplace</h5>
          <Link to="/">Browse listings</Link>
          <Link to="/post">Post an ad</Link>
          <Link to="/favorites">My favorites</Link>
          <Link to="/chat">Messages</Link>
        </div>
        <div>
          <h5>Account</h5>
          <Link to="/profile">Profile</Link>
          <Link to="/my-listings">My listings</Link>
          <Link to="/login">Login</Link>
          <Link to="/register">Sign up</Link>
        </div>
        <div>
          <h5>Help &amp; About</h5>
          <a href="#">How it works</a>
          <a href="#">Safety tips</a>
          <a href="#">Contact us</a>
          <a href="#">FAQ</a>
        </div>
        <div>
          <h5>Legal</h5>
          <a href="#">Terms of service</a>
          <a href="#">Privacy policy</a>
          <a href="#">Cookie policy</a>
          <a href="#">Refund policy</a>
        </div>
      </div>
    </div>

    <div className="site-footer-bottom">
      <div className="container row between">
        <span className="text-sm muted">
          © {year} SYT — Sell Your Things. All rights reserved.
        </span>
        <span className="text-sm muted">
          Made with care in India 🇮🇳
        </span>
      </div>
    </div>
  </footer>
);

import { FC } from 'react';
import { Outlet } from 'react-router-dom';
import { Navbar } from './Navbar';
import { Footer } from './Footer';

export const Layout: FC = () => (
  <div className="app-shell">
    <Navbar />
    <main className="layout-main">
      <div className="container">
        <Outlet />
      </div>
    </main>
    <Footer />
  </div>
);

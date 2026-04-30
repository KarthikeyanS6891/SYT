import { FC } from 'react';
import { Outlet } from 'react-router-dom';
import { Navbar } from './Navbar';

export const Layout: FC = () => (
  <>
    <Navbar />
    <main className="layout-main">
      <div className="container">
        <Outlet />
      </div>
    </main>
  </>
);

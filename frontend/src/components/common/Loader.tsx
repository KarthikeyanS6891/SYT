import { FC } from 'react';

export const Loader: FC<{ inline?: boolean }> = ({ inline }) =>
  inline ? <span className="spinner" /> : (
    <div className="loader-page"><span className="spinner" /></div>
  );

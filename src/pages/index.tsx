import type {ReactNode} from 'react';
import {Redirect} from '@docusaurus/router';

// Remove homepage: redirect root to the docs entry page
export default function Home(): ReactNode {
  return <Redirect to="/intro" />;
}

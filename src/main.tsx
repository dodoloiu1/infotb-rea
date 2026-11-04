import { render } from 'preact';
import 'leaflet/dist/leaflet.css';
import './styles/infotb.css';
import { App } from './App';

render(<App />, document.getElementById('app')!);

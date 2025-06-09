import Header from './components/Header';
import { ThemeProvider } from './context/ThemeProvider';

function App() {
  return (
    <ThemeProvider>
      <Header />
      {/* <GameControls /> */}
    </ThemeProvider>
  );
}

export default App;

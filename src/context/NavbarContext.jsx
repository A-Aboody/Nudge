import { createContext, useContext } from 'react';

const NavbarContext = createContext();

export const NavbarProvider = ({ children }) => {
  return (
    <NavbarContext.Provider value={{}}>
      {children}
    </NavbarContext.Provider>
  );
};

export const useNavbar = () => useContext(NavbarContext);
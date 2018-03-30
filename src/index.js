import React, { createContext, Fragment } from 'react';
import ReactDOM from 'react-dom';
import { Spinner } from './Spinner';
import './index.css';
import 'glamor/reset';
// We reimplemented some of React Router 4 for use with React 16.4 alphas
import { Router, Route, Link } from './MiniRouter';

// CACHE!
let cache = new Map();
let pending = new Map();

// simple fetcher
function createFetcher(method, hash = x => x) {
  const resolved = new Map();
  return {
    read(obj) {
      const key = hash(obj);
      if (!resolved.has(key)) {
        throw method(obj).then(v => resolved.set(key, v));
        return;
      }
      return resolved.get(key);
    },
  };
}

// Cooler version of createFetcher
function createResource(promise, getKey = x => x) {
  return {
    read(obj) {
      const key = getKey(obj);
      if (cache.has(key)) {
        console.log('cache hit');
        return cache.get(key);
      }
      if (pending.has(key)) {
        console.log('pending hit', pending.get(key));
        throw pending.get(key);
      }
      console.log('cache miss');
      let p = promise(obj).then(val => {
        pending.delete(key);
        cache.set(key, val);
      });
      pending.set(key, p);
      throw p;
    },
    flush() {
      cache = new Map();
      pending = new Map();
    },
    refetch(key) {
      cache.delete(key);
      this.read(key);
    },
  };
}

// Timeout with a fallback
function Timeout({ ms, fallback, children }) {
  return (
    <React.Timeout ms={ms}>
      {didTimeout => (
        <Fragment>
          <span hidden={didTimeout}>{children(didTimeout)}</span>
          {didTimeout ? fallback : null}
        </Fragment>
      )}
    </React.Timeout>
  );
}

const ensureQuote = createResource(async function(ticker) {
  const res = await fetch(
    `https://api.iextrading.com/1.0/stock/${ticker}/quote?displayPercent=true`
  );
  return await res.json();
});

const ensureDelay = createFetcher(
  ({ id, ms }) => new Promise(resolve => setTimeout(() => resolve(id), ms)),
  obj => obj.id
);
const CacheContext = React.createContext(null);

class CacheProvider extends React.Component {
  render() {
    return (
      <CacheContext.Provider value={cache}>{this.props.children}</CacheContext.Provider>
    );
  }
}

export const withCache = Comp => props => (
  <CacheContext.Consumer>
    {cache => <Comp {...props} cache={cache} />}
  </CacheContext.Consumer>
);

// Some stuff to put in our routes....
function Stock({ ticker }) {
  const result = ensureQuote.read(ticker);
  console.log(result);
  // Assume this is deeply nested (and that you don't want
  // import the cache into every component)...
  return (
    <div>
      {result.companyName} <small>({result.symbol})</small> {result.change}%
    </div>
  );
}

// A helper to extremify loading delays for this example
function Delay({ id, ms }) {
  const l = ensureDelay.read({ id, ms });
  return <div>{id}</div>;
}

const AsyncRouteContext = createContext('asyncRoute');

const AsyncRouteProvider = ({ ms, fallback, children }) => (
  <Timeout ms={ms} fallback={fallback}>
    {didExpire => {
      console.log({ didExpire });
      return (
        <Fragment>
          <AsyncRouteContext.Provider value={didExpire}>
            {children}
          </AsyncRouteContext.Provider>
        </Fragment>
      );
    }}
  </Timeout>
);

const AsyncRoute = routeProps => (
  <Route
    {...routeProps}
    render={renderProps => (
      <Fragment>
        <AsyncRouteContext.Consumer>
          {didExpire => (
            <AsyncRouteRenderer {...routeProps} {...renderProps} didExpire={didExpire} />
          )}
        </AsyncRouteContext.Consumer>
      </Fragment>
    )}
  />
);

class AsyncRouteRenderer extends React.Component {
  state = {
    incoming: false,
    outgoing: false,
  };

  componentDidUpdate({ match: prevMatch, didExpire: prevDidExpire }) {
    const { path, match, didExpire } = this.props;

    if (didExpire === prevDidExpire) {
      return;
    }

    if (match && !prevMatch) {
      this.setState({ incoming: true, outgoing: false });
    } else if (!match && prevMatch) {
      this.setState({ incomfing: false, outgoing: true });
    } else {
      this.setState({ incoming: false, outgoing: false });
    }
  }

  render() {
    const { match, path, didExpire, render, children } = this.props;
    const { incoming, outgoing } = this.state;

    if (match && !incoming && !outgoing && !didExpire) {
      return children
        ? typeof children === 'function' ? children(this.props) : children
        : render ? render(this.props) : null;
    }

    if (incoming && !didExpire) {
      return children
        ? typeof children === 'function' ? children(this.props) : children
        : render ? render(this.props) : null;
    } else if (incoming && didExpire) {
      return null;
    } else if (outgoing && didExpire) {
      return children
        ? typeof children === 'function' ? children(this.props) : children
        : render ? render(this.props) : null;
    } else if (outgoing && !didExpire) {
      return null;
    }

    return null;
  }
}

const container = document.getElementById('root');
const root = ReactDOM.createRoot(container);

root.render(
  <Router>
    <div style={{ padding: 20 }}>
      <div>
        <Link style={{ marginRight: 4 }} to="/">
          Home
        </Link>
        <Link style={{ marginRight: 4 }} to="/settings">
          Settings
        </Link>
        <Link to="/about">About</Link>
      </div>
      <AsyncRouteProvider ms={5000} fallback={<Spinner />}>
        <AsyncRoute
          exact
          path="/"
          render={() => (
            <div>
              <h1>Home</h1>
              <Link style={{ marginRight: 4 }} to="/settings">
                Go Settings →
              </Link>
              <div style={{ marginTop: 10, color: '#999' }}>
                <small>
                  Notice the fallback spinner requires no additional code
                  <em> within the routes </em> themselves. This allows devs to code
                  without needing to think too hard about loading state--everything is
                  always defined in a route.
                </small>
              </div>
            </div>
          )}
        />
        <AsyncRoute
          exact
          path="/about"
          fallback={<Spinner />}
          ms={1000}
          render={() => (
            <div>
              <h1>About</h1>
              <Stock ticker={'aapl'} />
              <Delay id="fizzsd" ms={1000} />
            </div>
          )}
        />
        <AsyncRoute
          ms={1000}
          fallback={<Spinner />}
          exact
          path="/settings"
          render={() => (
            <div>
              <h1>Settings</h1>
              <Fragment>
                <Delay id="fizz" ms={1000} />
                <Delay id="buzz" ms={2000} />
              </Fragment>
            </div>
          )}
        />
      </AsyncRouteProvider>
    </div>
  </Router>
);

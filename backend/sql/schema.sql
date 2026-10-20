CREATE TABLE IF NOT EXISTS items (
    id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name varchar(100) NOT NULL CHECK (char_length(btrim(name)) BETWEEN 2 AND 100),
    code varchar(30) NOT NULL UNIQUE CHECK (code ~ '^[A-Z0-9][A-Z0-9-]{1,29}$'),
    category text NOT NULL CHECK (category IN ('Elektronik', 'Furnitur', 'Laboratorium', 'Perlengkapan')),
    location varchar(100) NOT NULL CHECK (char_length(btrim(location)) BETWEEN 2 AND 100),
    quantity integer NOT NULL CHECK (quantity BETWEEN 0 AND 100000),
    status text NOT NULL CHECK (status IN ('available', 'borrowed', 'maintenance'))
);

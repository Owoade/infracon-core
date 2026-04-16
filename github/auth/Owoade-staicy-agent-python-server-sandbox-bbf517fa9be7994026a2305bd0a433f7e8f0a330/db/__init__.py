from sqlalchemy import create_engine

# Create the engine to connect to the PostgreSQL database
engine = create_engine('postgresql://user:password@localhost:5432/staicy')